// packages/server/src/mcp.ts

import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { markAsAgentId } from "@custardcream/relay-shared";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import yaml from "js-yaml";
import { z } from "zod";
import { getWorkflow, loadAgents, loadPool } from "./agents/loader";
import type { AgentPersona, AgentsFile } from "./agents/types";
import {
  getInstanceId,
  getPort,
  getProjectRoot,
  getRelayDir,
  getSessionId,
  setProjectRoot,
  setSessionId,
  uriToPath,
} from "./config";
import { broadcast } from "./dashboard/websocket";
import { getDb } from "./db/client";
import { getTaskById } from "./db/queries/tasks";
import { handleGetArtifact, handlePostArtifact } from "./tools/artifacts";
import { handleAppendMemory, handleReadMemory, handleWriteMemory } from "./tools/memory";
import { handleGetMessages, handleSendMessage } from "./tools/messaging";
import { handleRequestReview, handleSubmitReview } from "./tools/review";
import {
  handleGetSessionSummary,
  handleListSessions,
  handleSaveSessionSummary,
} from "./tools/sessions";
import {
  handleClaimTask,
  handleCreateTask,
  handleGetAllTasks,
  handleGetMyTasks,
  handleGetTeamStatus,
  handleUpdateTask,
} from "./tools/tasks";

const _require = createRequire(import.meta.url);
const { version: SERVER_VERSION } = _require("../package.json") as { version: string };

export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: "relay",
    version: SERVER_VERSION,
  });

  // Returns the actual dashboard URL and server metadata.
  // Skills call this during pre-flight to discover the correct port (auto-selected 3456–3465).
  server.tool(
    "get_server_info",
    {
      agent_id: z
        .string()
        .regex(/^[a-zA-Z0-9_-]+$/)
        .max(64)
        .describe("ID of the calling agent (for tracking)"),
    },
    async () => {
      const port = getPort();
      // When port is null the dashboard failed to bind (EADDRINUSE) — do not fabricate a URL
      const dashboardUrl = port != null ? `http://localhost:${port}` : null;
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: true,
              dashboardUrl,
              dashboardAvailable: port != null,
              port,
              sessionId: getSessionId(),
              instanceId: getInstanceId() ?? null,
            }),
          },
        ],
      };
    }
  );

  // Declares the active session ID for this relay run.
  // Call once at the start of each /relay:relay invocation — before any other tools.
  // All subsequent tool calls in this process will use the given session ID.
  // Also broadcasts session:started to reset the live dashboard view.
  server.tool(
    "start_session",
    {
      agent_id: z
        .string()
        .regex(/^[a-zA-Z0-9_-]+$/)
        .max(64)
        .describe("ID of the calling agent (for tracking)"),
      session_id: z
        .string()
        .regex(/^[a-zA-Z0-9_-]+$/)
        .max(128)
        .describe("Session ID to activate (e.g. 2026-03-14-007)"),
    },
    async (input) => {
      setSessionId(input.session_id);
      broadcast({ type: "session:started", sessionId: input.session_id, timestamp: Date.now() });
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ success: true, session_id: input.session_id }),
          },
        ],
      };
    }
  );

  // --- messaging tools ---

  // Send a message from one agent to another (or broadcast to all agents)
  server.tool(
    "send_message",
    {
      agent_id: z
        .string()
        .regex(/^[a-zA-Z0-9_-]+$/)
        .max(64)
        .describe(
          "ID of the sending agent (e.g. pm, fe, be, qa). Must be alphanumeric, hyphen, or underscore."
        ),
      to: z
        .string()
        .regex(/^[a-zA-Z0-9_-]+$/)
        .max(64)
        .nullable()
        .optional()
        .describe(
          "ID of the recipient agent. Set to null or omit to broadcast to all agents in the session."
        ),
      content: z.string().max(65536).describe("Message content (plain text or Markdown)."),
      thread_id: z
        .string()
        .regex(/^[a-zA-Z0-9_-]+$/)
        .max(256)
        .optional()
        .describe("Thread ID to group related messages (e.g. a task ID or review ID). Optional."),
      metadata: z
        .record(z.string(), z.string())
        .optional()
        .describe(
          "Optional key-value pairs for structured context (e.g. { task_id: 'abc', severity: 'high' }). Values must be strings."
        ),
    },
    async (input) => {
      const result = await handleSendMessage(getDb(), getSessionId(), input);
      if (result.success) {
        broadcast({
          type: "message:new",
          message: result.message,
          timestamp: Date.now(),
        });
      }
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    }
  );

  // Retrieve messages received by an agent — includes direct messages and broadcasts, excluding own broadcasts.
  server.tool(
    "get_messages",
    {
      agent_id: z
        .string()
        .regex(/^[a-zA-Z0-9_-]+$/)
        .max(64)
        .describe(
          "ID of the agent fetching messages. Returns messages addressed to this agent plus all broadcasts (excluding own)."
        ),
    },
    async (input) => {
      const result = await handleGetMessages(getDb(), getSessionId(), input);
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    }
  );

  // --- tasks tools ---

  // Create a new task on the session task board
  server.tool(
    "create_task",
    {
      agent_id: z
        .string()
        .regex(/^[a-zA-Z0-9_-]+$/)
        .max(64)
        .describe("ID of the agent creating the task."),
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
        .array(z.string())
        .optional()
        .describe(
          "Optional list of task IDs that must reach 'done' before this task can be started. Enables dependency chains."
        ),
    },
    async (input) => {
      const result = await handleCreateTask(getDb(), getSessionId(), input);
      if (result.success && result.task_id) {
        broadcast({
          type: "task:updated",
          task: {
            id: result.task_id,
            title: input.title,
            assignee: input.assignee ?? null,
            status: "todo",
            priority: input.priority,
            description: input.description ?? null,
          },
          timestamp: Date.now(),
        });
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
      agent_id: z
        .string()
        .regex(/^[a-zA-Z0-9_-]+$/)
        .max(64)
        .describe("ID of the agent performing the update."),
      task_id: z.string().describe("ID of the task to update. Must belong to the current session."),
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
      const result = await handleUpdateTask(
        getDb(),
        getSessionId(),
        input,
        agentHooks,
        getProjectRoot()
      );
      if (result.success) {
        const task = getTaskById(getDb(), input.task_id, getSessionId());
        if (task) {
          broadcast({
            type: "task:updated",
            task: {
              id: task.id,
              title: task.title,
              assignee: task.assignee,
              status: task.status,
              priority: task.priority,
              description: task.description,
            },
            timestamp: Date.now(),
          });
        }
      }
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    }
  );

  // Fetch tasks assigned to the calling agent. Use get_all_tasks for the full board view.
  server.tool(
    "get_my_tasks",
    {
      agent_id: z
        .string()
        .regex(/^[a-zA-Z0-9_-]+$/)
        .max(64)
        .describe("ID of the agent whose assigned tasks to fetch."),
    },
    async (input) => {
      const result = await handleGetMyTasks(getDb(), getSessionId(), input);
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
      agent_id: z
        .string()
        .regex(/^[a-zA-Z0-9_-]+$/)
        .max(64)
        .describe(
          "ID of the agent claiming the task. The task must be assigned to this agent or unassigned."
        ),
      task_id: z
        .string()
        .describe(
          "ID of the task to claim. The task must be in 'todo' status. Obtain IDs from get_all_tasks."
        ),
    },
    async (input) => {
      const agentHooks = getAgents(getSessionId())?.[input.agent_id]?.hooks;
      const result = await handleClaimTask(
        getDb(),
        getSessionId(),
        input,
        agentHooks,
        getProjectRoot()
      );
      if (result.claimed) {
        const task = getTaskById(getDb(), input.task_id, getSessionId());
        if (task) {
          broadcast({
            type: "task:updated",
            task: {
              id: task.id,
              title: task.title,
              assignee: task.assignee,
              status: task.status,
              priority: task.priority,
              description: task.description,
            },
            timestamp: Date.now(),
          });
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
      agent_id: z
        .string()
        .regex(/^[a-zA-Z0-9_-]+$/)
        .max(64)
        .describe("ID of the calling agent."),
    },
    async (input) => {
      const result = await handleGetTeamStatus(getDb(), getSessionId(), input);
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    }
  );

  // Returns all tasks in the session regardless of assignee.
  // Use the optional status filter to narrow results without client-side filtering.
  server.tool(
    "get_all_tasks",
    {
      agent_id: z
        .string()
        .regex(/^[a-zA-Z0-9_-]+$/)
        .max(64)
        .describe("ID of the calling agent."),
      status: z
        .enum(["todo", "in_progress", "in_review", "done"])
        .optional()
        .describe(
          "Optional status filter. When provided, only tasks with this status are returned. Omit to return all tasks."
        ),
    },
    async (input) => {
      const result = await handleGetAllTasks(getDb(), getSessionId(), input);
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    }
  );

  // --- artifacts tools ---

  // Store a deliverable artifact (design, PR, report, document, etc.) for the session.
  // After posting, use request_review to route it to a reviewer agent.
  server.tool(
    "post_artifact",
    {
      agent_id: z
        .string()
        .regex(/^[a-zA-Z0-9_-]+$/)
        .max(64)
        .describe("ID of the agent posting the artifact."),
      name: z
        .string()
        .max(256)
        .describe(
          "Unique artifact name within the session (e.g. login-design, cart-fe-pr). Used by get_artifact to retrieve it."
        ),
      type: z
        .enum(["figma_spec", "pr", "report", "analytics_plan", "design", "document"])
        .describe("Artifact type. Choose the closest match to the content being stored."),
      content: z
        .string()
        .max(524288)
        .describe("Artifact content (JSON, Markdown, or plain text). Max 512 KB."),
      task_id: z
        .string()
        .optional()
        .describe("ID of the task this artifact fulfills. Links the artifact to a task card."),
    },
    async (input) => {
      const result = await handlePostArtifact(getDb(), getSessionId(), input);
      if (result.success && result.artifact_id) {
        broadcast({
          type: "artifact:posted",
          artifact: {
            id: result.artifact_id,
            name: input.name,
            type: input.type,
            created_by: input.agent_id,
          },
          timestamp: Date.now(),
        });
      }
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    }
  );

  // Retrieve an artifact by name. Returns the latest artifact with the given name if multiple exist.
  server.tool(
    "get_artifact",
    {
      agent_id: z
        .string()
        .regex(/^[a-zA-Z0-9_-]+$/)
        .max(64)
        .describe("ID of the agent fetching the artifact."),
      name: z
        .string()
        .max(256)
        .describe("Name of the artifact to retrieve. Must match the name used in post_artifact."),
    },
    async (input) => {
      const result = await handleGetArtifact(getDb(), getSessionId(), input);
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    }
  );

  // --- review tools ---

  // Request a peer review for a posted artifact. The reviewer agent receives a review:requested event.
  // After calling this, update the task to 'in_review' status and send the reviewer a message with the review_id.
  server.tool(
    "request_review",
    {
      agent_id: z
        .string()
        .regex(/^[a-zA-Z0-9_-]+$/)
        .max(64)
        .describe("ID of the agent requesting the review (the author)."),
      artifact_id: z
        .string()
        .describe(
          "ID of the artifact to be reviewed. Obtain from post_artifact response (artifact_id field)."
        ),
      reviewer: z
        .string()
        .regex(/^[a-zA-Z0-9_-]+$/)
        .max(64)
        .describe(
          "ID of the agent who should perform the review (e.g. qa, be2). They will call submit_review with the returned review_id."
        ),
    },
    async (input) => {
      const result = await handleRequestReview(getDb(), getSessionId(), input);
      if (result.success && result.review_id) {
        broadcast({
          type: "review:requested",
          review: {
            id: result.review_id,
            artifact_id: input.artifact_id,
            reviewer: input.reviewer,
            requester: input.agent_id,
          },
          timestamp: Date.now(),
        });
      }
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    }
  );

  // Submit a review decision. Only the assigned reviewer may call this.
  // On 'approved', the author can update the task to 'done'. On 'changes_requested', author must revise.
  server.tool(
    "submit_review",
    {
      agent_id: z
        .string()
        .regex(/^[a-zA-Z0-9_-]+$/)
        .max(64)
        .describe(
          "ID of the reviewing agent. Must match the reviewer field set in request_review, otherwise returns permission denied."
        ),
      review_id: z.string().describe("Review ID returned by request_review."),
      status: z
        .enum(["approved", "changes_requested"])
        .describe(
          "Review outcome. 'approved' signals the work is accepted. 'changes_requested' means the author must revise."
        ),
      comments: z
        .string()
        .max(16384)
        .optional()
        .describe("Detailed review feedback. Required when status is 'changes_requested'."),
    },
    async (input) => {
      const result = await handleSubmitReview(getDb(), getSessionId(), input);
      if (result.success && result.review) {
        broadcast({
          type: "review:updated",
          review: result.review,
          timestamp: Date.now(),
        });
      }
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    }
  );

  // --- memory tools ---

  // Read agent or project memory
  server.tool(
    "read_memory",
    {
      agent_id: z
        .string()
        .regex(/^[a-zA-Z0-9_-]+$/)
        .max(64)
        .optional()
        .describe("Agent ID. Omit to return project.md only."),
    },
    async (input) => {
      const result = await handleReadMemory(getRelayDir(), input);
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    }
  );

  // Write (overwrite) a memory section
  server.tool(
    "write_memory",
    {
      agent_id: z
        .string()
        .regex(/^[a-zA-Z0-9_-]+$/)
        .max(64)
        .optional()
        .describe("Agent ID. Omit to write to project.md"),
      key: z.string().describe("Memory section key (e.g. conventions, api-patterns)"),
      content: z.string().max(131072).describe("Content to store"),
    },
    async (input) => {
      const result = await handleWriteMemory(getRelayDir(), input);
      if (result.success) {
        broadcast({
          type: "memory:updated",
          agentId: markAsAgentId(input.agent_id ?? "unknown"),
          timestamp: Date.now(),
        });
      }
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    }
  );

  // Append to memory (accumulate entries)
  server.tool(
    "append_memory",
    {
      agent_id: z
        .string()
        .regex(/^[a-zA-Z0-9_-]+$/)
        .max(64)
        .describe("Agent ID. Use save_session_summary for session retrospectives."),
      content: z.string().max(131072).describe("Content to append"),
    },
    async (input) => {
      const result = await handleAppendMemory(getRelayDir(), input);
      if (result.success) {
        broadcast({
          type: "memory:updated",
          agentId: markAsAgentId(input.agent_id),
          timestamp: Date.now(),
        });
      }
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    }
  );

  // --- sessions tools ---

  // Save a session summary (call at session end)
  server.tool(
    "save_session_summary",
    {
      agent_id: z
        .string()
        .regex(/^[a-zA-Z0-9_-]+$/)
        .max(64)
        .describe("ID of the calling agent (typically the orchestrator)"),
      session_id: z
        .string()
        .regex(/^[a-zA-Z0-9_-]+$/)
        .max(128)
        .describe("Session ID (YYYY-MM-DD-NNN-XXXX format)"),
      summary: z.string().max(131072).describe("Session summary text"),
    },
    async (input) => {
      const result = await handleSaveSessionSummary(getRelayDir(), input);
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    }
  );

  // List all sessions
  server.tool(
    "list_sessions",
    {
      agent_id: z
        .string()
        .regex(/^[a-zA-Z0-9_-]+$/)
        .max(64)
        .describe("ID of the calling agent"),
    },
    async (_input) => {
      const result = await handleListSessions(getRelayDir());
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    }
  );

  // Retrieve a specific session summary
  server.tool(
    "get_session_summary",
    {
      agent_id: z
        .string()
        .regex(/^[a-zA-Z0-9_-]+$/)
        .max(64)
        .describe("ID of the calling agent"),
      session_id: z
        .string()
        .regex(/^[a-zA-Z0-9_-]+$/)
        .max(128)
        .describe("ID of the session to retrieve"),
    },
    async (input) => {
      const result = await handleGetSessionSummary(getRelayDir(), { session_id: input.session_id });
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    }
  );

  // Broadcast an agent's current thinking to the dashboard.
  // Emits two WebSocket events: agent:thinking (streaming text) and agent:status=working.
  // Call this before significant operations so the dashboard shows the agent as active.
  server.tool(
    "broadcast_thinking",
    {
      agent_id: z
        .string()
        .regex(/^[a-zA-Z0-9_-]+$/)
        .max(64)
        .describe(
          "ID of the agent sharing their thinking. Sets the agent's status to 'working' in the dashboard."
        ),
      content: z
        .string()
        .max(65536)
        .describe(
          "What the agent is currently thinking or about to do. Streamed to the Agent Thoughts panel in the dashboard."
        ),
    },
    async (input) => {
      const agentId = markAsAgentId(input.agent_id);
      const timestamp = Date.now();
      // Emit agent:status=working so the dashboard marks the agent as active immediately
      broadcast({ type: "agent:status", agentId, status: "working", timestamp });
      broadcast({ type: "agent:thinking", agentId, chunk: input.content, timestamp });
      return { content: [{ type: "text", text: JSON.stringify({ success: true }) }] };
    }
  );

  // --- agents tools ---

  // Lazy agent cache — populated on first list_agents call, after setProjectRoot() has been set.
  // Loading at createMcpServer() time would use CWD=/tmp (bunx behavior) and always return [].
  // Session-specific files are written once per /relay:relay run and never mutate; no TTL needed.
  // Key: session_id string, or "__default__" for the no-session-id case.
  const agentsCache = new Map<string, Record<string, AgentPersona>>();

  // Pool cache with TTL — pool file can change between sessions (e.g. during development).
  // Stale-after-5-minutes ensures users see the updated pool without restarting the server.
  const POOL_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
  let pool: Record<string, AgentPersona> | null = null;
  let poolCachedAt = 0;

  /**
   * Load agents for a given session ID.
   * Returns null when the session file does not exist (caller must surface an error).
   * Returns the cached result on subsequent calls for the same session.
   */
  function getAgents(sessionId?: string): Record<string, AgentPersona> | null {
    // Validate sessionId to prevent path traversal and cache key poisoning.
    // Return null so list_agents surfaces an error rather than silently returning an empty team.
    if (sessionId && !/^[a-zA-Z0-9_-]+$/.test(sessionId)) {
      return null;
    }

    const cacheKey = sessionId ?? "__default__";
    // biome-ignore lint/style/noNonNullAssertion: get() is safe after has() check
    if (agentsCache.has(cacheKey)) return agentsCache.get(cacheKey)!;

    let result: Record<string, AgentPersona>;
    try {
      if (sessionId) {
        // Load session-specific agent file: .relay/session-agents-{session_id}.yml
        const sessionFile = join(getRelayDir(), `session-agents-${sessionId}.yml`);
        if (existsSync(sessionFile)) {
          const parsed = yaml.load(readFileSync(sessionFile, "utf-8")) as Parameters<
            typeof loadPool
          >[0];
          if (!parsed) {
            console.error(`[relay] session file is empty or malformed: ${sessionFile}`);
          }
          // Load pool agents as fallback for extends resolution.
          // This allows session-file agents to extend pool agents by ID (e.g. fe2: { extends: fe }).
          // Pool load failure is non-fatal — extends will still work within the session file.
          let poolAgents: Record<string, AgentPersona> | undefined;
          try {
            poolAgents = getPool();
          } catch {
            poolAgents = undefined;
          }
          result = loadAgents(parsed ?? { agents: {} }, poolAgents);
        } else {
          // Session file not found — return null so the caller can return a distinct error.
          // Do NOT cache null: callers should be able to retry after the file is written.
          console.error(`[relay] session file not found: ${sessionFile}`);
          return null;
        }
      } else {
        // No session_id — pre-flight uses list_pool_agents, not list_agents.
        result = {};
      }
    } catch (err) {
      // Load failed (e.g. malformed YAML) — return null so list_agents surfaces a clear error
      // rather than silently returning an empty team. Do NOT cache null so callers can retry.
      console.error(
        `[relay] failed to load agents for session "${sessionId ?? "__default__"}":`,
        (err as Error).message
      );
      return null;
    }

    agentsCache.set(cacheKey, result);
    return result;
  }

  function getPool(): Record<string, AgentPersona> {
    const now = Date.now();
    if (pool !== null && now - poolCachedAt < POOL_CACHE_TTL_MS) {
      return pool;
    }
    // Re-load (cache miss or expired). Do NOT update poolCachedAt on error — this allows
    // the caller to retry immediately after creating the pool file. Updating the timestamp
    // on failure would trap the caller in a 5-minute TTL even after the file is ready.
    pool = loadPool(); // throws if no pool file found or YAML is malformed
    poolCachedAt = now;
    return pool;
  }

  server.tool(
    "list_agents",
    {
      agent_id: z
        .string()
        .regex(/^[a-zA-Z0-9_-]+$/)
        .max(64)
        .describe("ID of the calling agent (for tracking)"),
      session_id: z
        .string()
        .regex(/^[a-zA-Z0-9_-]+$/)
        .max(128)
        .optional()
        .describe(
          "Session ID to scope agent loading. When provided, loads .relay/session-agents-{session_id}.yml (written by /relay:relay Team Composition)."
        ),
    },
    async (input) => {
      const agents = getAgents(input.session_id);
      // Return an explicit error when a session_id was given but the file is missing.
      // This lets the orchestrator distinguish "0 agents" from "file not yet written".
      if (agents === null) {
        const relayDir = getRelayDir();
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: false,
                error: `Session agents file not found: ${relayDir}/session-agents-${input.session_id}.yml — run team composition first`,
              }),
            },
          ],
        };
      }
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: true,
              agents: Object.values(agents).map((a) => ({
                id: a.id,
                name: a.name,
                emoji: a.emoji,
                description: a.description,
                tools: a.tools,
                // Language directive is already injected by buildSystemPromptWithMemory() in loader.ts.
                // Return the raw systemPrompt here to avoid duplicating the directive.
                systemPrompt: a.systemPrompt,
                basePersonaId: a.basePersonaId, // expose for dashboard agent disambiguation
              })),
            }),
          },
        ],
      };
    }
  );

  // Returns all available pool agents (metadata only — no systemPrompt) for team selection
  server.tool(
    "list_pool_agents",
    {
      agent_id: z
        .string()
        .regex(/^[a-zA-Z0-9_-]+$/)
        .max(64)
        .describe("ID of the calling agent (for tracking)"),
    },
    async () => {
      let agents: ReturnType<typeof getPool>;
      try {
        agents = getPool();
      } catch (err) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: false,
                error: (err as Error).message,
              }),
            },
          ],
        };
      }
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: true,
              agents: Object.values(agents).map((a) => ({
                id: a.id,
                name: a.name,
                emoji: a.emoji,
                description: a.description,
                tags: a.tags,
                tools: a.tools,
                // systemPrompt intentionally omitted — pool metadata only
              })),
            }),
          },
        ],
      };
    }
  );

  // Retrieve workflow configuration from the active pool file
  server.tool(
    "get_workflow",
    {
      agent_id: z
        .string()
        .regex(/^[a-zA-Z0-9_-]+$/)
        .max(64)
        .describe("ID of the calling agent (for tracking)"),
    },
    async () => {
      let poolFile: AgentsFile | null = null;
      try {
        const relayDir = getRelayDir();
        const projectRoot = getProjectRoot();
        const relayPoolPath = join(relayDir, "agents.pool.yml");
        const rootPoolPath = join(projectRoot, "agents.pool.yml");
        if (existsSync(relayPoolPath)) {
          poolFile = yaml.load(readFileSync(relayPoolPath, "utf-8")) as AgentsFile;
        } else if (existsSync(rootPoolPath)) {
          poolFile = yaml.load(readFileSync(rootPoolPath, "utf-8")) as AgentsFile;
        }
      } catch {
        // Pool file read failure — return empty workflow
      }
      const workflow = getWorkflow(poolFile ?? { agents: {} });
      return {
        content: [{ type: "text", text: JSON.stringify({ success: true, workflow }) }],
      };
    }
  );

  return server;
}

export async function startMcpServer(server: McpServer): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Ask the MCP client (Claude Code) for workspace roots to resolve the project directory.
  // This fixes the bunx CWD=/tmp problem without requiring any per-project configuration.
  try {
    const { roots } = await server.server.listRoots();
    if (roots.length > 0) {
      const projectRoot = uriToPath(roots[0].uri);
      setProjectRoot(projectRoot);
      console.error(`[relay] project root: ${projectRoot}`);
    } else {
      console.error(
        "[relay] roots/list returned empty — falling back to RELAY_PROJECT_ROOT or cwd"
      );
    }
  } catch {
    // Client does not support roots — fall back to RELAY_PROJECT_ROOT env var or process.cwd()
    console.error(
      "[relay] roots/list not supported by client — falling back to RELAY_PROJECT_ROOT or cwd"
    );
  }

  console.error("[relay] MCP server started (stdio)");
}
