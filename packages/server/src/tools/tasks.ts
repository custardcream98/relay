import type { TaskPriority, TaskStatus } from "@custardcream/relay-shared";
import type { ResolvedAgentHooks } from "../agents/types";
import {
  claimTask,
  getAllTasks,
  getTaskByExternalId,
  getTaskById,
  getTasksByAssignee,
  getTeamStatus,
  insertTask,
  type TaskRow,
  updateTask,
} from "../store";
import { DEFAULT_AFTER_TIMEOUT_MS, DEFAULT_BEFORE_TIMEOUT_MS, runHooks } from "./hook-runner";

// Build the env vars injected into before_task and after_task hooks.
// Centralised here to avoid duplicating the same object literal in claim and update flows.
function buildHookEnv(agentId: string, taskId: string, sessionId: string): Record<string, string> {
  return {
    RELAY_AGENT_ID: agentId,
    RELAY_TASK_ID: taskId,
    RELAY_SESSION_ID: sessionId,
  };
}

// Create a task and return its generated ID.
// If idempotency_key is provided and a task with that key already exists in the session,
// returns the existing task_id without creating a duplicate — safe for re-spawned agents.
export function handleCreateTask(
  sessionId: string,
  input: {
    agent_id: string;
    title: string;
    description?: string;
    assignee?: string;
    priority: TaskPriority;
    depends_on?: string[];
    idempotency_key?: string;
  }
) {
  try {
    if (input.idempotency_key) {
      const existing = getTaskByExternalId(sessionId, input.idempotency_key);
      if (existing) return { success: true, task_id: existing.id };
    }
    const id = crypto.randomUUID();
    insertTask({
      id,
      session_id: sessionId,
      title: input.title,
      description: input.description ?? null,
      assignee: input.assignee ?? null,
      status: "todo",
      priority: input.priority,
      created_by: input.agent_id,
      depends_on: input.depends_on ?? [],
      external_id: input.idempotency_key ?? null,
    });
    return { success: true, task_id: id };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// Update a task's status or assignee.
// Returns success: false if the task does not exist or belongs to a different session.
// Only the task's assignee or creator can update it. Unassigned tasks can be updated by anyone.
// If hooks.after_task is set and status is being set to "done", the hook runs after the store write.
// Non-zero exit reverts the status back to "in_review".
export async function handleUpdateTask(
  sessionId: string,
  input: { agent_id: string; task_id: string; status?: TaskStatus; assignee?: string },
  hooks?: ResolvedAgentHooks,
  projectRoot?: string
) {
  try {
    const updates: Partial<Pick<TaskRow, "status" | "assignee" | "description">> = {};
    if (input.status !== undefined) updates.status = input.status;
    if (input.assignee !== undefined) updates.assignee = input.assignee;
    // Guard against empty updates before hitting the store
    if (Object.keys(updates).length === 0) {
      return { success: false, error: "No valid fields to update" };
    }

    // Ownership check: only the assignee or creator may update the task.
    // Unassigned tasks (assignee === null) are open to any agent.
    const existing = getTaskById(input.task_id, sessionId);
    if (!existing) return { success: false, error: "task not found" };
    if (
      existing.assignee !== null &&
      existing.assignee !== input.agent_id &&
      existing.created_by !== input.agent_id
    ) {
      return { success: false, error: "permission denied: not the task assignee or creator" };
    }

    const updated = updateTask(input.task_id, sessionId, updates);
    if (!updated) return { success: false, error: "task not found" };

    // Run after_task hook when status transitions to "done".
    // Runs AFTER the store write (store is in-memory and cannot fail, so no need for pre-write guard).
    // Non-zero exit reverts the task status back to "in_review".
    if (input.status === "done" && hooks?.after_task?.length) {
      const hookEnv = buildHookEnv(input.agent_id, input.task_id, sessionId);
      const hookResult = await runHooks(
        hooks.after_task,
        hookEnv,
        projectRoot ?? process.cwd(),
        DEFAULT_AFTER_TIMEOUT_MS
      );
      if (!hookResult.success) {
        // Revert status to in_review so the agent knows to fix the issue
        updateTask(input.task_id, sessionId, { status: "in_review" });
        return {
          success: false,
          // hook_failed: true distinguishes this from "task not found" (success: false without hook_failed).
          // Agents should treat hook_failed as "fix the issue and retry update_task(done)"
          // vs. task-not-found as a permanent error requiring a different recovery strategy.
          hook_failed: true,
          error: `after_task hook failed (exit ${hookResult.exitCode ?? "timeout"}): ${hookResult.output}`,
        };
      }
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// Fetch all tasks assigned to an agent
export function handleGetMyTasks(
  sessionId: string,
  input: { agent_id: string; include_description?: boolean }
) {
  try {
    const tasks = getTasksByAssignee(sessionId, input.agent_id);
    const result = input.include_description ? tasks : tasks.map(({ description: _d, ...t }) => t);
    return { success: true, tasks: result };
  } catch (err) {
    return { success: false, tasks: [], error: String(err) };
  }
}

// Atomically claim a task. Returns claimed: true only if the task is 'todo' and assigned to (or unassigned from) the agent.
// session_id is passed to prevent cross-session claims.
// If the task has depends_on entries, all referenced tasks must be in 'done' state first.
// If hooks.before_task is set, the shell command runs BEFORE claiming. Non-zero exit blocks claiming.
export async function handleClaimTask(
  sessionId: string,
  input: { agent_id: string; task_id: string },
  hooks?: ResolvedAgentHooks,
  projectRoot?: string
) {
  try {
    // Check depends_on before attempting the atomic claim
    const task = getTaskById(input.task_id, sessionId);
    if (task && (task.depends_on ?? []).length > 0) {
      const unmetIds: string[] = [];
      for (const depId of task.depends_on ?? []) {
        const dep = getTaskById(depId, sessionId);
        if (!dep || dep.status !== "done") {
          unmetIds.push(depId);
        }
      }
      if (unmetIds.length > 0) {
        return {
          success: true,
          claimed: false,
          reason: `Unmet dependencies: ${unmetIds.join(", ")}`,
        };
      }
    }

    // Run before_task hook BEFORE claiming so a hook failure never creates a phantom in_progress task
    if (hooks?.before_task?.length) {
      const hookEnv = buildHookEnv(input.agent_id, input.task_id, sessionId);
      const hookResult = await runHooks(
        hooks.before_task,
        hookEnv,
        projectRoot ?? process.cwd(),
        DEFAULT_BEFORE_TIMEOUT_MS
      );
      if (!hookResult.success) {
        return {
          success: true,
          claimed: false,
          reason: `before_task hook failed (exit ${hookResult.exitCode ?? "timeout"}): ${hookResult.output}`,
        };
      }
    }

    // Re-check depends_on after the hook completes to close the TOCTOU window.
    // The before_task hook can take up to 30s, during which a dependency may have been
    // reverted from "done" back to "in_review" (e.g. via after_task hook failure).
    if (task && (task.depends_on ?? []).length > 0) {
      const unmetIds: string[] = [];
      for (const depId of task.depends_on ?? []) {
        const dep = getTaskById(depId, sessionId);
        if (!dep || dep.status !== "done") {
          unmetIds.push(depId);
        }
      }
      if (unmetIds.length > 0) {
        return {
          success: true,
          claimed: false,
          reason: `Unmet dependencies (re-check after hook): ${unmetIds.join(", ")}`,
        };
      }
    }

    const claimed = claimTask(input.task_id, input.agent_id, sessionId);
    if (!claimed) {
      return {
        success: true,
        claimed: false,
        reason: "Task is not in 'todo' state or is assigned to another agent",
      };
    }
    return { success: true, claimed: true };
  } catch (err) {
    return { success: false, claimed: false, error: String(err) };
  }
}

// Returns aggregated task counts for the session.
// Agents use has_pending_work to decide when to broadcast end:waiting or end:done.
export function handleGetTeamStatus(sessionId: string, _input: { agent_id: string }) {
  try {
    const status = getTeamStatus(sessionId);
    const has_pending_work = status.todo + status.in_progress + status.in_review > 0;
    return { success: true as const, ...status, has_pending_work };
  } catch (err) {
    return { success: false as const, error: String(err) };
  }
}

// Returns all tasks in the session regardless of assignee.
// Used by agents to get an overview of the entire team's work status.
// Optional status filter avoids client-side filtering for common queries.
// Descriptions are omitted by default to reduce token consumption — pass include_description: true when needed.
export function handleGetAllTasks(
  sessionId: string,
  input: { agent_id: string; status?: string; include_description?: boolean }
) {
  try {
    const tasks = getAllTasks(sessionId, input.status);
    const result = input.include_description ? tasks : tasks.map(({ description: _d, ...t }) => t);
    return { success: true, tasks: result };
  } catch (err) {
    return { success: false, tasks: [], error: String(err) };
  }
}
