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
