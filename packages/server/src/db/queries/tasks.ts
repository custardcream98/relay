import type { TaskRow, TeamStatusRow } from "../../store";
import {
  claimTask as storeClaimTask,
  getAllTasks as storeGetAllTasks,
  getTaskById as storeGetTaskById,
  getTasksByAssignee as storeGetTasksByAssignee,
  getTeamStatus as storeGetTeamStatus,
  insertTask as storeInsertTask,
  updateTask as storeUpdateTask,
} from "../../store";

export type { TaskRow, TeamStatusRow } from "../../store";

// Insert a task into the in-memory store
export function insertTask(task: Omit<TaskRow, "created_at" | "updated_at">): void {
  storeInsertTask(task);
}

// Update a task's status, assignee, or description.
// Returns true if the task was found and updated, false otherwise.
export function updateTask(
  id: string,
  sessionId: string,
  updates: Partial<Pick<TaskRow, "status" | "assignee" | "description">>
): boolean {
  return storeUpdateTask(id, sessionId, updates);
}

// Look up a task by ID, scoped to a session to prevent cross-session reads
export function getTaskById(id: string, sessionId: string): TaskRow | null {
  return storeGetTaskById(id, sessionId);
}

// Fetch all tasks assigned to a specific agent in a session
export function getTasksByAssignee(sessionId: string, assignee: string): TaskRow[] {
  return storeGetTasksByAssignee(sessionId, assignee);
}

// Fetch all tasks in a session, optionally filtered by status
export function getAllTasks(sessionId: string, status?: string): TaskRow[] {
  return storeGetAllTasks(sessionId, status);
}

// Atomically claim a task — transitions to 'in_progress' only if currently 'todo'
// and assigned to (or unassigned from) the agent.
export function claimTask(taskId: string, agentId: string, sessionId: string): boolean {
  return storeClaimTask(taskId, agentId, sessionId);
}

// Aggregated task counts by status for a session
export function getTeamStatus(sessionId: string): TeamStatusRow {
  return storeGetTeamStatus(sessionId);
}
