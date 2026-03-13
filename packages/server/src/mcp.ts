// packages/server/src/mcp.ts

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { getWorkflow, loadAgents } from "./agents/loader";
import type { AgentPersona } from "./agents/types";
import { getRelayDir, setProjectRoot, uriToPath } from "./config";
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

// Current session ID (injected via environment variable, defaults to "default")
const SESSION_ID = process.env.RELAY_SESSION_ID ?? "default";

export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: "relay",
    version: "0.1.0",
  });

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
      const result = await handleSendMessage(getDb(), SESSION_ID, input);
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
      const result = await handleGetMessages(getDb(), SESSION_ID, input);
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
      const result = await handleCreateTask(getDb(), SESSION_ID, input);
      if (result.success && result.task_id) {
        broadcast({
          type: "task:updated",
          task: {
            id: result.task_id,
            title: input.title,
            assignee: input.assignee ?? null,
            status: "todo",
            priority: input.priority,
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
      const result = await handleUpdateTask(getDb(), SESSION_ID, input);
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
      const result = await handleGetMyTasks(getDb(), SESSION_ID, input);
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    }
  );

  // 두 에이전트가 동일한 태스크를 동시에 가져가지 않도록 원자적으로 클레임
  server.tool(
    "claim_task",
    {
      agent_id: z.string().describe("ID of the agent claiming the task"),
      task_id: z.string().describe("ID of the task to claim"),
    },
    async (input) => {
      const result = await handleClaimTask(getDb(), SESSION_ID, input);
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
            },
            timestamp: Date.now(),
          });
        }
      }
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    }
  );

  // 집계된 태스크 수를 반환 — 에이전트가 has_pending_work로 end:waiting vs end:done 결정
  server.tool(
    "get_team_status",
    {
      agent_id: z.string().describe("ID of the calling agent"),
    },
    async (input) => {
      const result = await handleGetTeamStatus(getDb(), SESSION_ID, input);
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    }
  );

  // 담당자와 무관하게 세션 내 모든 태스크 반환
  server.tool(
    "get_all_tasks",
    {
      agent_id: z.string().describe("ID of the calling agent"),
    },
    async (input) => {
      const result = await handleGetAllTasks(getDb(), SESSION_ID, input);
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
      const result = await handlePostArtifact(getDb(), SESSION_ID, input);
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
      const result = await handleGetArtifact(getDb(), SESSION_ID, input);
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
      const result = await handleRequestReview(getDb(), SESSION_ID, input);
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
      const result = await handleSubmitReview(getDb(), SESSION_ID, input);
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
          agentId: input.agent_id ?? "unknown",
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
          agentId: input.agent_id ?? "unknown",
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

  // --- agents tools ---

  // 에이전트 로드 — agents.yml이 없을 경우 빈 배열로 graceful 처리 (서버 crash 방지)
  // list_agents가 빈 배열을 반환해야 /relay:init Phase 0 (팀 제안)가 동작함
  let agents: Record<string, AgentPersona>;
  try {
    agents = loadAgents();
  } catch {
    agents = {};
  }

  server.tool(
    "list_agents",
    {
      agent_id: z.string().describe("ID of the calling agent (for tracking)"),
    },
    async () => {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              Object.values(agents).map((a) => ({
                id: a.id,
                name: a.name,
                emoji: a.emoji,
                description: a.description,
                tools: a.tools,
                systemPrompt: a.systemPrompt, // For persona injection
              }))
            ),
          },
        ],
      };
    }
  );

  // Retrieve workflow configuration (used by the orchestrator to understand execution flow)
  server.tool(
    "get_workflow",
    {
      agent_id: z.string().describe("ID of the calling agent (for tracking)"),
    },
    async () => {
      const workflow = getWorkflow();
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

  // MCP roots/list로 클라이언트(Claude Code)의 워크스페이스 경로를 가져와 PROJECT_ROOT로 설정
  // bunx 실행 시 CWD가 /tmp가 되는 문제를 MCP 프로토콜 레벨에서 해결
  try {
    const { roots } = await server.server.listRoots();
    if (roots.length > 0) {
      const projectRoot = uriToPath(roots[0].uri);
      setProjectRoot(projectRoot);
      console.error(`[relay] project root: ${projectRoot}`);
    }
  } catch {
    // 클라이언트가 roots 기능을 지원하지 않는 경우 무시 (RELAY_PROJECT_ROOT env var 또는 cwd 사용)
  }

  console.error("[relay] MCP server started (stdio)");
}
