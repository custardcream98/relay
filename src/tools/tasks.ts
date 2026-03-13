import type { Database } from "bun:sqlite";
import type { TaskRow } from "../db/queries/tasks";
import { getTasksByAssignee, insertTask, updateTask } from "../db/queries/tasks";

// 태스크를 생성하고 생성된 태스크 ID를 반환한다
export function handleCreateTask(
  db: Database,
  sessionId: string,
  input: {
    agent_id: string;
    title: string;
    description?: string;
    assignee?: string;
    priority: string;
  }
) {
  const id = crypto.randomUUID();
  insertTask(db, {
    id,
    session_id: sessionId,
    title: input.title,
    description: input.description ?? null,
    assignee: input.assignee ?? null,
    status: "todo",
    priority: input.priority,
    created_by: input.agent_id,
  });
  return { success: true, task_id: id };
}

// 태스크 상태 또는 담당자를 업데이트한다
// 태스크가 존재하지 않으면 success: false 반환
export function handleUpdateTask(
  db: Database,
  _sessionId: string,
  input: { agent_id: string; task_id: string; status?: string; assignee?: string }
) {
  const updates: Partial<Pick<TaskRow, "status" | "assignee" | "description">> = {};
  if (input.status !== undefined) updates.status = input.status;
  if (input.assignee !== undefined) updates.assignee = input.assignee;
  const updated = updateTask(db, input.task_id, updates);
  if (!updated) return { success: false, error: "태스크를 찾을 수 없음" };
  return { success: true };
}

// 에이전트에게 할당된 태스크 목록을 조회한다
export function handleGetMyTasks(db: Database, sessionId: string, input: { agent_id: string }) {
  const tasks = getTasksByAssignee(db, sessionId, input.agent_id);
  return { success: true, tasks };
}
