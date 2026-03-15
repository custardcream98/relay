import type { SqliteDatabase } from "../types";

export interface TaskRow {
  id: string;
  session_id: string;
  title: string;
  description: string | null;
  assignee: string | null;
  status: string;
  priority: string;
  created_by: string;
  created_at: number;
  updated_at: number;
}

// Insert a task into the DB
export function insertTask(
  db: SqliteDatabase,
  task: Omit<TaskRow, "created_at" | "updated_at">
): void {
  db.prepare(`
    INSERT INTO tasks (id, session_id, title, description, assignee, status, priority, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    task.id,
    task.session_id,
    task.title,
    task.description,
    task.assignee,
    task.status,
    task.priority,
    task.created_by
  );
}

// Whitelist of allowed update columns — prevents SQL injection
const ALLOWED_UPDATE_KEYS = new Set(["status", "assignee", "description"]);

// Update a task's status, assignee, or description.
// Returns early (false) if updates is empty or contains only disallowed keys.
// Returns true if at least one row was affected, false otherwise.
// session_id is required to prevent cross-session writes.
export function updateTask(
  db: SqliteDatabase,
  id: string,
  sessionId: string,
  updates: Partial<Pick<TaskRow, "status" | "assignee" | "description">>
): boolean {
  const keys = Object.keys(updates).filter((k) => ALLOWED_UPDATE_KEYS.has(k));
  if (keys.length === 0) return false;
  const fields = keys.map((k) => `${k} = ?`).join(", ");
  const values = keys.map((k) => (updates as Record<string, string | number | null>)[k] ?? null);
  // Positional params: field values first, then id and session_id for WHERE clause
  const result = db
    .prepare(`UPDATE tasks SET ${fields}, updated_at = unixepoch() WHERE id = ? AND session_id = ?`)
    .run(...values, id, sessionId);
  return result.changes > 0;
}

// Look up a task by ID, scoped to a session to prevent cross-session reads
export function getTaskById(db: SqliteDatabase, id: string, sessionId: string): TaskRow | null {
  return (
    (db.prepare("SELECT * FROM tasks WHERE id = ? AND session_id = ?").get(id, sessionId) as
      | TaskRow
      | undefined) ?? null
  );
}

// Fetch all tasks assigned to a specific agent in a session
export function getTasksByAssignee(
  db: SqliteDatabase,
  sessionId: string,
  assignee: string
): TaskRow[] {
  return db
    .prepare("SELECT * FROM tasks WHERE session_id = ? AND assignee = ? ORDER BY created_at ASC")
    .all(sessionId, assignee) as TaskRow[];
}

// Fetch all tasks in a session
export function getAllTasks(db: SqliteDatabase, sessionId: string): TaskRow[] {
  return db
    .prepare("SELECT * FROM tasks WHERE session_id = ? ORDER BY created_at ASC")
    .all(sessionId) as TaskRow[];
}

// Atomically claim a task — transitions to 'in_progress' only if currently 'todo' and assigned to (or unassigned from) the agent.
// session_id is required to prevent cross-session claims.
// Returns true on success, false if the claim was rejected.
export function claimTask(
  db: SqliteDatabase,
  taskId: string,
  agentId: string,
  sessionId: string
): boolean {
  const result = db
    .prepare(`
    UPDATE tasks
    SET status = 'in_progress', updated_at = unixepoch()
    WHERE id = ?
      AND session_id = ?
      AND status = 'todo'
      AND (assignee = ? OR assignee IS NULL)
  `)
    .run(taskId, sessionId, agentId);
  return result.changes > 0;
}

export interface TeamStatusRow {
  todo: number;
  in_progress: number;
  in_review: number;
  done: number;
  total: number;
}

// Aggregated task counts by status for a session — used by agents to decide when work is complete
export function getTeamStatus(db: SqliteDatabase, sessionId: string): TeamStatusRow {
  return (
    (db
      .prepare(`
        SELECT
          COUNT(CASE WHEN status = 'todo' THEN 1 END)        AS todo,
          COUNT(CASE WHEN status = 'in_progress' THEN 1 END) AS in_progress,
          COUNT(CASE WHEN status = 'in_review' THEN 1 END)   AS in_review,
          COUNT(CASE WHEN status = 'done' THEN 1 END)        AS done,
          COUNT(*)                                            AS total
        FROM tasks
        WHERE session_id = ?
      `)
      .get(sessionId) as TeamStatusRow | undefined) ?? {
      todo: 0,
      in_progress: 0,
      in_review: 0,
      done: 0,
      total: 0,
    }
  );
}
