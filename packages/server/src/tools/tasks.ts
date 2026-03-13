import type { Database } from "bun:sqlite";
import type { TaskRow } from "../db/queries/tasks";
import {
  claimTask,
  getAllTasks,
  getTasksByAssignee,
  getTeamStatus,
  insertTask,
  updateTask,
} from "../db/queries/tasks";

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

// Atomically claim a task. Returns claimed: true only if the task is 'todo' and assigned to (or unassigned from) the agent.
export function handleClaimTask(
  db: Database,
  _sessionId: string,
  input: { agent_id: string; task_id: string }
) {
  const claimed = claimTask(db, input.task_id, input.agent_id);
  if (!claimed) {
    return {
      success: true,
      claimed: false,
      reason: "Task is not in 'todo' state or is assigned to another agent",
    };
  }
  return { success: true, claimed: true };
}

// Returns aggregated task counts for the session.
// Agents use has_pending_work to decide when to broadcast end:waiting or end:done.
export function handleGetTeamStatus(db: Database, sessionId: string, _input: { agent_id: string }) {
  const status = getTeamStatus(db, sessionId);
  const has_pending_work = status.todo + status.in_progress + status.in_review > 0;
  return { success: true, ...status, has_pending_work };
}

// Returns all tasks in the session regardless of assignee.
// Used by agents to get an overview of the entire team's work status.
export function handleGetAllTasks(db: Database, sessionId: string, _input: { agent_id: string }) {
  const tasks = getAllTasks(db, sessionId);
  return { success: true, tasks };
}
