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

// 태스크를 DB에 삽입한다
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

// 허용된 업데이트 컬럼 — SQL injection 방지용 화이트리스트
const ALLOWED_UPDATE_KEYS = new Set(["status", "assignee", "description"]);

// 태스크 상태/담당자/설명을 업데이트한다
// updates가 비어 있거나 허용되지 않은 키만 있으면 early return
// 영향받은 행이 있으면 true, 없으면 false 반환
export function updateTask(
  db: Database,
  id: string,
  updates: Partial<Pick<TaskRow, "status" | "assignee" | "description">>
): boolean {
  const keys = Object.keys(updates).filter((k) => ALLOWED_UPDATE_KEYS.has(k));
  if (keys.length === 0) return false;
  const fields = keys.map((k) => `${k} = $${k}`).join(", ");
  // bun:sqlite named parameter는 객체 키에 $ prefix가 필요하다
  // 값 타입을 SQLQueryBindings 허용 타입으로 명시적으로 지정
  const params: Record<string, string | number | null> = { $id: id };
  for (const k of keys) {
    const v = (updates as Record<string, string | number | null>)[k];
    params[`$${k}`] = v ?? null;
  }
  db.query(`UPDATE tasks SET ${fields}, updated_at = unixepoch() WHERE id = $id`).run(params);
  // 실제로 업데이트된 행이 있는지 확인
  const result = db.query("SELECT changes() as n").get() as { n: number };
  return result.n > 0;
}

// ID로 태스크를 조회한다
export function getTaskById(db: Database, id: string): TaskRow | null {
  return db.query<TaskRow, [string]>("SELECT * FROM tasks WHERE id = ?").get(id) ?? null;
}

// 특정 세션에서 담당자별 태스크를 조회한다
export function getTasksByAssignee(db: Database, sessionId: string, assignee: string): TaskRow[] {
  return db
    .query<TaskRow, [string, string]>(
      "SELECT * FROM tasks WHERE session_id = ? AND assignee = ? ORDER BY created_at ASC"
    )
    .all(sessionId, assignee);
}

// 세션의 모든 태스크를 조회한다
export function getAllTasks(db: Database, sessionId: string): TaskRow[] {
  return db
    .query<TaskRow, [string]>("SELECT * FROM tasks WHERE session_id = ? ORDER BY created_at ASC")
    .all(sessionId);
}
