import type { Database } from "bun:sqlite";
import type { TaskRow } from "../db/queries/tasks";
import { getTasksByAssignee, insertTask, updateTask } from "../db/queries/tasks";

// Create a task and return its generated ID
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

// Update a task's status or assignee.
// Returns success: false if the task does not exist.
export function handleUpdateTask(
  db: Database,
  _sessionId: string,
  input: { agent_id: string; task_id: string; status?: string; assignee?: string }
) {
  const updates: Partial<Pick<TaskRow, "status" | "assignee" | "description">> = {};
  if (input.status !== undefined) updates.status = input.status;
  if (input.assignee !== undefined) updates.assignee = input.assignee;
  const updated = updateTask(db, input.task_id, updates);
  if (!updated) return { success: false, error: "task not found" };
  return { success: true };
}

// Fetch all tasks assigned to an agent
export function handleGetMyTasks(db: Database, sessionId: string, input: { agent_id: string }) {
  const tasks = getTasksByAssignee(db, sessionId, input.agent_id);
  return { success: true, tasks };
}
