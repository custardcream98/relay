import type { Database } from "bun:sqlite";
import { insertTask, updateTask, getTasksByAssignee } from "../db/queries/tasks";
import type { TaskRow } from "../db/queries/tasks";
import { randomUUID } from "crypto";

// 태스크를 생성하고 생성된 태스크 ID를 반환한다
export async function handleCreateTask(
  db: Database,
  sessionId: string,
  input: { agent_id: string; title: string; description?: string; assignee?: string; priority: string }
) {
  const id = randomUUID();
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
export async function handleUpdateTask(
  db: Database,
  sessionId: string,
  input: { agent_id: string; task_id: string; status?: string; assignee?: string }
) {
  const updates: Partial<Pick<TaskRow, "status" | "assignee" | "description">> = {};
  if (input.status !== undefined) updates.status = input.status;
  if (input.assignee !== undefined) updates.assignee = input.assignee;
  updateTask(db, input.task_id, updates);
  return { success: true };
}

// 에이전트에게 할당된 태스크 목록을 조회한다
export async function handleGetMyTasks(
  db: Database,
  sessionId: string,
  input: { agent_id: string }
) {
  const tasks = getTasksByAssignee(db, sessionId, input.agent_id);
  return { success: true, tasks };
}
