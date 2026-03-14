// packages/server/src/mcp.ts

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { markAsAgentId } from "@custardcream/relay-shared";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import yaml from "js-yaml";
import { z } from "zod";
import { getWorkflow, loadPool } from "./agents/loader";
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

export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: "relay",
    version: "0.1.0",
  });

  // Returns the actual dashboard URL and server metadata.
  // Skills call this during pre-flight to discover the correct port (auto-selected 3456–3465).
  server.tool(
    "get_server_info",
    {
      agent_id: z.string().describe("ID of the calling agent (for tracking)"),
    },
    async () => {
      const port = getPort();
      const dashboardUrl = port ? `http://localhost:${port}` : "http://localhost:3456";
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              dashboardUrl,
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
      agent_id: z.string().describe("ID of the calling agent (for tracking)"),
      session_id: z
        .string()
        .regex(/^[a-zA-Z0-9_-]+$/)
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

  // Send a message from one agent to another (or broadcast)
  server.tool(
    "send_message",
    {
      agent_id: z.string().describe("ID of the sending agent (e.g. pm, fe, be, qa)"),
      to: z.string().nullable().describe("ID of the recipient agent. null for broadcast"),
      content: z.string().describe("Message content"),
      thread_id: z.string().optional().describe("Thread ID (optional)"),
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

  // Retrieve messages received by an agent
  server.tool(
    "get_messages",
    {
      agent_id: z.string().describe("ID of the agent whose messages to fetch"),
    },
    async (input) => {
      const result = await handleGetMessages(getDb(), getSessionId(), input);
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    }
  );

  // --- tasks tools ---

  // Create a new task
  server.tool(
    "create_task",
    {
      agent_id: z.string().describe("ID of the agent creating the task"),
      title: z.string().describe("Task title"),
      description: z.string().optional().describe("Detailed description and acceptance criteria"),
      assignee: z.string().optional().describe("ID of the agent assigned to the task"),
      priority: z.enum(["critical", "high", "medium", "low"]).describe("Task priority"),
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

  // Update a task's status or assignee
  server.tool(
    "update_task",
    {
      agent_id: z.string().describe("ID of the agent performing the update"),
      task_id: z.string().describe("ID of the task to update"),
      status: z
        .enum(["todo", "in_progress", "in_review", "done"])
        .optional()
        .describe("New status"),
      assignee: z.string().optional().describe("New assignee"),
    },
    async (input) => {
      const result = await handleUpdateTask(getDb(), getSessionId(), input);
      if (result.success) {
        const task = getTaskById(getDb(), input.task_id);
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

  // Fetch tasks assigned to an agent
  server.tool(
    "get_my_tasks",
    {
      agent_id: z.string().describe("ID of the agent whose tasks to fetch"),
    },
    async (input) => {
      const result = await handleGetMyTasks(getDb(), getSessionId(), input);
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    }
  );

  // Atomically claim a task so two agents cannot pick up the same task concurrently
  server.tool(
    "claim_task",
    {
      agent_id: z.string().describe("ID of the agent claiming the task"),
      task_id: z.string().describe("ID of the task to claim"),
    },
    async (input) => {
      const result = await handleClaimTask(getDb(), getSessionId(), input);
      if (result.claimed) {
        const task = getTaskById(getDb(), input.task_id);
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

  // Returns aggregated task counts — agents use has_pending_work to decide end:waiting vs end:done
  server.tool(
    "get_team_status",
    {
      agent_id: z.string().describe("ID of the calling agent"),
    },
    async (input) => {
      const result = await handleGetTeamStatus(getDb(), getSessionId(), input);
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    }
  );

  // Returns all tasks in the session regardless of assignee
  server.tool(
    "get_all_tasks",
    {
      agent_id: z.string().describe("ID of the calling agent"),
    },
    async (input) => {
      const result = await handleGetAllTasks(getDb(), getSessionId(), input);
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    }
  );

  // --- artifacts tools ---

  // Store an artifact
  server.tool(
    "post_artifact",
    {
      agent_id: z.string().describe("ID of the agent posting the artifact"),
      name: z.string().describe("Artifact name (e.g. login-design, cart-fe-pr)"),
      type: z
        .enum(["figma_spec", "pr", "report", "analytics_plan", "design"])
        .describe("Artifact type"),
      content: z.string().describe("Artifact content (JSON or Markdown)"),
      task_id: z.string().optional().describe("Associated task ID"),
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

  // Retrieve an artifact by name
  server.tool(
    "get_artifact",
    {
      agent_id: z.string().describe("ID of the agent fetching the artifact"),
      name: z.string().describe("Name of the artifact to retrieve"),
    },
    async (input) => {
      const result = await handleGetArtifact(getDb(), getSessionId(), input);
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    }
  );

  // --- review tools ---

  // Request a review for an artifact
  server.tool(
    "request_review",
    {
      agent_id: z.string().describe("ID of the agent requesting the review"),
      artifact_id: z.string().describe("ID of the artifact to be reviewed"),
      reviewer: z.string().describe("ID of the reviewer agent (e.g. fe2, be2)"),
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

  // Submit a review decision
  server.tool(
    "submit_review",
    {
      agent_id: z.string().describe("ID of the agent submitting the review"),
      review_id: z.string().describe("Review ID"),
      status: z.enum(["approved", "changes_requested"]).describe("Review outcome"),
      comments: z.string().optional().describe("Review comments"),
    },
    async (input) => {
      const result = await handleSubmitReview(getDb(), getSessionId(), input);
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    }
  );

  // --- memory tools ---

  // Read agent or project memory
  server.tool(
    "read_memory",
    {
      agent_id: z.string().optional().describe("Agent ID. Omit to return project.md + lessons.md"),
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
      agent_id: z.string().optional().describe("Agent ID. Omit to write to project.md"),
      key: z.string().describe("Memory section key (e.g. conventions, api-patterns)"),
      content: z.string().describe("Content to store"),
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
      agent_id: z.string().optional().describe("Agent ID. Omit to append to lessons.md"),
      content: z.string().describe("Content to append"),
    },
    async (input) => {
      const result = await handleAppendMemory(getRelayDir(), input);
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

  // --- sessions tools ---

  // Save a session summary (call at session end)
  server.tool(
    "save_session_summary",
    {
      agent_id: z.string().describe("ID of the calling agent (typically the orchestrator)"),
      session_id: z.string().describe("Session ID (YYYY-MM-DD-NNN format)"),
      summary: z.string().describe("Session summary text"),
      tasks: z.array(z.record(z.string(), z.unknown())).describe("All tasks in the session"),
      messages: z.array(z.record(z.string(), z.unknown())).describe("All messages in the session"),
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
      agent_id: z.string().describe("ID of the calling agent"),
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
      agent_id: z.string().describe("ID of the calling agent"),
      session_id: z.string().describe("ID of the session to retrieve"),
    },
    async (input) => {
      const result = await handleGetSessionSummary(getRelayDir(), { session_id: input.session_id });
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    }
  );

  // Broadcast an agent's current thinking to the dashboard (agent:thinking WebSocket event)
  server.tool(
    "broadcast_thinking",
    {
      agent_id: z.string().describe("ID of the agent sharing their thinking"),
      content: z.string().describe("What the agent is about to do or thinking about"),
    },
    async (input) => {
      broadcast({
        type: "agent:thinking",
        agentId: markAsAgentId(input.agent_id),
        chunk: input.content,
        timestamp: Date.now(),
      });
      return { content: [{ type: "text", text: JSON.stringify({ success: true }) }] };
    }
  );

  // --- agents tools ---

  // Lazy agent cache — populated on first list_agents call, after setProjectRoot() has been set.
  // Loading at createMcpServer() time would use CWD=/tmp (bunx behavior) and always return [].
  // Key: session_id string, or "__default__" for the no-session-id case.
  const agentsCache = new Map<string, Record<string, AgentPersona>>();
  let pool: Record<string, AgentPersona> | null = null;

  function getAgents(sessionId?: string): Record<string, AgentPersona> {
    // Validate sessionId to prevent path traversal and cache key poisoning
    if (sessionId && !/^[a-zA-Z0-9_-]+$/.test(sessionId)) {
      return {};
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
          result = loadPool(parsed ?? { agents: {} });
        } else {
          // No session-specific file — return empty. Pool-only architecture:
          // teams are always composed via /relay:relay before list_agents is called with a sessionId.
          result = {};
        }
      } else {
        // No session_id — pre-flight uses list_pool_agents, not list_agents.
        result = {};
      }
    } catch {
      // Pool load failed — return empty
      result = {};
    }

    agentsCache.set(cacheKey, result);
    return result;
  }

  function getPool(): Record<string, AgentPersona> {
    if (pool === null) {
      try {
        pool = loadPool();
      } catch (err) {
        // Pool not configured or failed to load — fall back to empty for graceful degradation
        console.error("[relay] pool load failed:", (err as Error).message);
        pool = {};
      }
    }
    return pool;
  }

  server.tool(
    "list_agents",
    {
      agent_id: z.string().describe("ID of the calling agent (for tracking)"),
      session_id: z
        .string()
        .optional()
        .describe(
          "Session ID to scope agent loading. When provided, loads .relay/session-agents-{session_id}.yml (written by /relay:relay Team Composition)."
        ),
    },
    async (input) => {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              Object.values(getAgents(input.session_id)).map((a) => ({
                id: a.id,
                name: a.name,
                emoji: a.emoji,
                description: a.description,
                tools: a.tools,
                // Include language instruction so the orchestrating skill applies it when spawning
                systemPrompt: a.language
                  ? `${a.systemPrompt}\n\n## Language\n\nYou MUST respond in ${a.language} at all times.`
                  : a.systemPrompt,
              }))
            ),
          },
        ],
      };
    }
  );

  // Returns all available pool agents (metadata only — no systemPrompt) for team selection
  server.tool(
    "list_pool_agents",
    {
      agent_id: z.string().describe("ID of the calling agent (for tracking)"),
    },
    async () => {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              Object.values(getPool()).map((a) => ({
                id: a.id,
                name: a.name,
                emoji: a.emoji,
                description: a.description,
                tags: a.tags,
                tools: a.tools,
                // systemPrompt intentionally omitted — pool metadata only
              }))
            ),
          },
        ],
      };
    }
  );

  // Retrieve workflow configuration from the active pool file
  server.tool(
    "get_workflow",
    {
      agent_id: z.string().describe("ID of the calling agent (for tracking)"),
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
        content: [{ type: "text", text: JSON.stringify(workflow) }],
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
