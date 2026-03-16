// packages/server/src/tools/register-tasks.ts
// Registers create_task, update_task, claim_task, get_my_tasks, get_all_tasks,
// and get_team_status MCP tools on the server.

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getAgents } from "../agents/cache.js";
import { getProjectRoot, getSessionId } from "../config.js";
import { broadcast } from "../dashboard/websocket.js";
import { AGENT_ID_SCHEMA } from "../schemas.js";
import { getTaskById } from "../store.js";
import { taskToPayload } from "../utils/broadcast.js";
import {
  handleClaimTask,
  handleCreateTask,
  handleGetAllTasks,
  handleGetMyTasks,
  handleGetTeamStatus,
  handleUpdateTask,
} from "./tasks.js";

export function registerTaskTools(server: McpServer): void {
  // Create a new task on the session task board
  server.tool(
    "create_task",
    {
      agent_id: AGENT_ID_SCHEMA.describe("ID of the agent creating the task."),
      title: z.string().max(256).describe("Short task title shown in the Kanban column header."),
      description: z
        .string()
        .max(8192)
        .optional()
        .describe(
          "Detailed task description including acceptance criteria and implementation notes. Supports Markdown."
        ),
      assignee: z
        .string()
        .regex(/^[a-zA-Z0-9_-]+$/)
        .max(64)
        .optional()
        .describe(
          "ID of the agent to assign. If omitted, the task is unassigned and any agent can claim it."
        ),
      priority: z
        .enum(["critical", "high", "medium", "low"])
        .describe("Task priority. critical=blocking, high=this sprint, medium=next, low=backlog."),
      depends_on: z
        .array(
          z
            .string()
            .regex(
              /^[a-zA-Z0-9_-]+$/,
              "depends_on: each task ID must be alphanumeric, hyphen, or underscore"
            )
            .max(128, "depends_on: each task ID must be ≤ 128 characters")
        )
        .max(32, "depends_on: max 32 dependencies per task")
        .optional()
        .describe(
          "Optional list of task IDs that must reach 'done' before this task can be started. Enables dependency chains."
        ),
      idempotency_key: z
        .string()
        .max(256)
        .optional()
        .describe(
          "Optional idempotency key. If a task with this key already exists in the session, returns the existing task_id without creating a duplicate. Use to make create_task safe to call again after agent re-spawn."
        ),
    },
    async (input) => {
      // handleCreateTask is synchronous; no await needed but the handler must be async
      // for consistent MCP tool handler typing across all tools.
      const result = handleCreateTask(getSessionId(), input);
      if (result.success && result.task_id) {
        const task = getTaskById(result.task_id, getSessionId());
        if (task) {
          broadcast({ type: "task:updated", task: taskToPayload(task), timestamp: Date.now() });
        }
      }
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    }
  );

  // Update a task's status or assignee. At least one of status or assignee must be provided.
  // When setting status to "done", the agent's after_task hook (if configured) runs after the store write.
  // Hook failure reverts status to "in_review" and returns { success: false, hook_failed: true, error }.
  // { success: false } without hook_failed means the task was not found — these require different recovery.
  server.tool(
    "update_task",
    "Update a task's status or assignee. When setting status to 'done', the agent's after_task hook (if configured) runs; a non-zero exit reverts status to 'in_review' and returns { success: false, hook_failed: true, error } — fix the issue and retry. A { success: false } without hook_failed means the task was not found.",
    {
      agent_id: AGENT_ID_SCHEMA.describe("ID of the agent performing the update."),
      task_id: z
        .string()
        .max(128)
        .describe("ID of the task to update. Must belong to the current session."),
      status: z
        .enum(["todo", "in_progress", "in_review", "done"])
        .optional()
        .describe(
          "New task status. Use 'in_review' before requesting a review, 'done' after work is accepted."
        ),
      assignee: z
        .string()
        .regex(/^[a-zA-Z0-9_-]+$/)
        .max(64)
        .optional()
        .describe("New assignee agent ID. Use to reassign a task to another agent."),
    },
    async (input) => {
      const agentHooks = getAgents(getSessionId())?.[input.agent_id]?.hooks;
      const result = await handleUpdateTask(getSessionId(), input, agentHooks, getProjectRoot());
      if (result.success) {
        const task = getTaskById(input.task_id, getSessionId());
        if (task) {
          broadcast({ type: "task:updated", task: taskToPayload(task), timestamp: Date.now() });
        }
      }
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    }
  );

  // Fetch tasks assigned to the calling agent. Use get_all_tasks for the full board view.
  server.tool(
    "get_my_tasks",
    {
      agent_id: AGENT_ID_SCHEMA.describe("ID of the agent whose assigned tasks to fetch."),
      include_description: z
        .boolean()
        .optional()
        .describe(
          "Whether to include full task descriptions in the response. Defaults to false to reduce token consumption. Set to true only when you need the full description to begin work."
        ),
    },
    async (input) => {
      const result = await handleGetMyTasks(getSessionId(), input);
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    }
  );

  // Atomically claim a task — transitions it to 'in_progress' only if it is currently 'todo'.
  // Safe to call concurrently; at most one agent will receive claimed: true for the same task.
  // If the agent has a before_task hook, it runs BEFORE the claim; non-zero exit returns claimed: false
  // without creating a phantom in_progress state.
  server.tool(
    "claim_task",
    "Atomically claim a task — transitions it to 'in_progress' only if currently 'todo'. Safe to call concurrently. If the agent has a before_task hook configured, it runs before the claim; a non-zero exit blocks claiming (claimed: false) without creating phantom in_progress state. Returns { success: true, claimed: true } on success or { success: true, claimed: false, reason } if blocked (already taken, unmet deps, or hook failed).",
    {
      agent_id: AGENT_ID_SCHEMA.describe(
        "ID of the agent claiming the task. The task must be assigned to this agent or unassigned."
      ),
      task_id: z
        .string()
        .max(128)
        .describe(
          "ID of the task to claim. The task must be in 'todo' status. Obtain IDs from get_all_tasks."
        ),
    },
    async (input) => {
      const agentHooks = getAgents(getSessionId())?.[input.agent_id]?.hooks;
      const result = await handleClaimTask(getSessionId(), input, agentHooks, getProjectRoot());
      if (result.claimed) {
        const task = getTaskById(input.task_id, getSessionId());
        if (task) {
          broadcast({ type: "task:updated", task: taskToPayload(task), timestamp: Date.now() });
        }
      }
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    }
  );

  // Returns aggregated task counts (todo/in_progress/in_review/done) for the session.
  // Also returns has_pending_work: boolean — agents use this to decide between end:waiting and end:_done.
  server.tool(
    "get_team_status",
    {
      agent_id: AGENT_ID_SCHEMA.describe("ID of the calling agent."),
    },
    async (input) => {
      const result = await handleGetTeamStatus(getSessionId(), input);
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    }
  );

  // Returns all tasks in the session regardless of assignee.
  // Use the optional status filter to narrow results without client-side filtering.
  server.tool(
    "get_all_tasks",
    {
      agent_id: AGENT_ID_SCHEMA.describe("ID of the calling agent."),
      status: z
        .enum(["todo", "in_progress", "in_review", "done"])
        .optional()
        .describe(
          "Optional status filter. When provided, only tasks with this status are returned. Omit to return all tasks."
        ),
      include_description: z
        .boolean()
        .optional()
        .describe(
          "Whether to include full task descriptions in the response. Defaults to false to reduce token consumption. Set to true only when you need descriptions (e.g. when selecting a task to claim)."
        ),
    },
    async (input) => {
      const result = await handleGetAllTasks(getSessionId(), input);
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    }
  );
}
