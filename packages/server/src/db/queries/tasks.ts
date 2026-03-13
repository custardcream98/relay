import type { Database } from "bun:sqlite";

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
export function insertTask(db: Database, task: Omit<TaskRow, "created_at" | "updated_at">): void {
  db.query(`
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
export function updateTask(
  db: Database,
  id: string,
  updates: Partial<Pick<TaskRow, "status" | "assignee" | "description">>
): boolean {
  const keys = Object.keys(updates).filter((k) => ALLOWED_UPDATE_KEYS.has(k));
  if (keys.length === 0) return false;
  const fields = keys.map((k) => `${k} = $${k}`).join(", ");
  // bun:sqlite named parameters require a $ prefix on object keys
  const params: Record<string, string | number | null> = { $id: id };
  for (const k of keys) {
    const v = (updates as Record<string, string | number | null>)[k];
    params[`$${k}`] = v ?? null;
  }
  db.query(`UPDATE tasks SET ${fields}, updated_at = unixepoch() WHERE id = $id`).run(params);
  // Check whether any rows were actually updated
  const result = db.query("SELECT changes() as n").get() as { n: number };
  return result.n > 0;
}

// Look up a task by ID
export function getTaskById(db: Database, id: string): TaskRow | null {
  return db.query<TaskRow, [string]>("SELECT * FROM tasks WHERE id = ?").get(id) ?? null;
}

// Fetch all tasks assigned to a specific agent in a session
export function getTasksByAssignee(db: Database, sessionId: string, assignee: string): TaskRow[] {
  return db
    .query<TaskRow, [string, string]>(
      "SELECT * FROM tasks WHERE session_id = ? AND assignee = ? ORDER BY created_at ASC"
    )
    .all(sessionId, assignee);
}

// Fetch all tasks in a session
export function getAllTasks(db: Database, sessionId: string): TaskRow[] {
  return db
    .query<TaskRow, [string]>("SELECT * FROM tasks WHERE session_id = ? ORDER BY created_at ASC")
    .all(sessionId);
}

// Atomically claim a task — transitions to 'in_progress' only if currently 'todo' and assigned to (or unassigned from) the agent.
// Returns true on success, false if the claim was rejected.
export function claimTask(db: Database, taskId: string, agentId: string): boolean {
  db.query(`
    UPDATE tasks
    SET status = 'in_progress', updated_at = unixepoch()
    WHERE id = $id
      AND status = 'todo'
      AND (assignee = $agentId OR assignee IS NULL)
  `).run({ $id: taskId, $agentId: agentId });
  const result = db.query("SELECT changes() as n").get() as { n: number };
  return result.n > 0;
}

export interface TeamStatusRow {
  todo: number;
  in_progress: number;
  in_review: number;
  done: number;
  total: number;
}

// Aggregated task counts by status for a session — used by agents to decide when work is complete
export function getTeamStatus(db: Database, sessionId: string): TeamStatusRow {
  return (
    db
      .query<TeamStatusRow, [string]>(`
        SELECT
          COUNT(CASE WHEN status = 'todo' THEN 1 END)        AS todo,
          COUNT(CASE WHEN status = 'in_progress' THEN 1 END) AS in_progress,
          COUNT(CASE WHEN status = 'in_review' THEN 1 END)   AS in_review,
          COUNT(CASE WHEN status = 'done' THEN 1 END)        AS done,
          COUNT(*)                                            AS total
        FROM tasks
        WHERE session_id = ?
      `)
      .get(sessionId) ?? { todo: 0, in_progress: 0, in_review: 0, done: 0, total: 0 }
  );
}
