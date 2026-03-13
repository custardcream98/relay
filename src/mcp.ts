// src/mcp.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { handleSendMessage, handleGetMessages } from "./tools/messaging";
import { handleCreateTask, handleUpdateTask, handleGetMyTasks } from "./tools/tasks";
import { handlePostArtifact, handleGetArtifact } from "./tools/artifacts";
import { handleRequestReview, handleSubmitReview } from "./tools/review";
import { getDb } from "./db/client";
import { broadcast } from "./dashboard/websocket";
import { getTaskById } from "./db/queries/tasks";
import { loadAgents, getWorkflow } from "./agents/loader";

// 현재 세션 ID (환경변수로 주입, 기본값 "default")
const SESSION_ID = process.env.RELAY_SESSION_ID ?? "default";

export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: "relay",
    version: "0.1.0",
  });

  // --- messaging 툴 등록 ---

  // 에이전트 간 메시지 전송
  server.tool("send_message", {
    agent_id: z.string().describe("보내는 에이전트 ID (예: pm, fe, be, qa)"),
    to: z.string().nullable().describe("받는 에이전트 ID. null이면 브로드캐스트"),
    content: z.string().describe("메시지 내용"),
    thread_id: z.string().optional().describe("스레드 ID (선택)"),
  }, async (input) => {
    const result = await handleSendMessage(getDb(), SESSION_ID, input);
    if (result.success) {
      broadcast({
        type: "message:new",
        message: result.message,
        timestamp: Date.now(),
      });
    }
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  });

  // 에이전트 수신 메시지 조회
  server.tool("get_messages", {
    agent_id: z.string().describe("조회할 에이전트 ID"),
  }, async (input) => {
    const result = await handleGetMessages(getDb(), SESSION_ID, input);
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  });

  // --- tasks 툴 등록 ---

  // 새 태스크 생성
  server.tool("create_task", {
    agent_id: z.string().describe("태스크를 생성하는 에이전트 ID"),
    title: z.string().describe("태스크 제목"),
    description: z.string().optional().describe("상세 설명 및 완료 기준"),
    assignee: z.string().optional().describe("담당 에이전트 ID"),
    priority: z.enum(["critical", "high", "medium", "low"]).describe("우선순위"),
  }, async (input) => {
    const result = await handleCreateTask(getDb(), SESSION_ID, input);
    if (result.success && result.task_id) {
      broadcast({
        type: "task:updated",
        task: { id: result.task_id, title: input.title, assignee: input.assignee ?? null, status: "todo", priority: input.priority },
        timestamp: Date.now(),
      });
    }
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  });

  // 태스크 상태/담당자 업데이트
  server.tool("update_task", {
    agent_id: z.string().describe("업데이트하는 에이전트 ID"),
    task_id: z.string().describe("업데이트할 태스크 ID"),
    status: z.enum(["todo", "in_progress", "in_review", "done"]).optional().describe("새 상태"),
    assignee: z.string().optional().describe("새 담당자"),
  }, async (input) => {
    const result = await handleUpdateTask(getDb(), SESSION_ID, input);
    if (result.success) {
      const task = getTaskById(getDb(), input.task_id);
      if (task) {
        broadcast({
          type: "task:updated",
          task: { id: task.id, title: task.title, assignee: task.assignee, status: task.status, priority: task.priority },
          timestamp: Date.now(),
        });
      }
    }
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  });

  // 내 태스크 목록 조회
  server.tool("get_my_tasks", {
    agent_id: z.string().describe("조회할 에이전트 ID"),
  }, async (input) => {
    const result = await handleGetMyTasks(getDb(), SESSION_ID, input);
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  });

  // --- artifacts 툴 등록 ---

  // 아티팩트 저장
  server.tool("post_artifact", {
    agent_id: z.string().describe("아티팩트를 올리는 에이전트 ID"),
    name: z.string().describe("아티팩트 이름 (예: login-design, cart-fe-pr)"),
    type: z.enum(["figma_spec", "pr", "report", "analytics_plan", "design"]).describe("아티팩트 종류"),
    content: z.string().describe("아티팩트 내용 (JSON 또는 Markdown)"),
    task_id: z.string().optional().describe("연관 태스크 ID"),
  }, async (input) => {
    const result = await handlePostArtifact(getDb(), SESSION_ID, input);
    if (result.success && result.artifact_id) {
      broadcast({
        type: "artifact:posted",
        artifact: { id: result.artifact_id, name: input.name, type: input.type, created_by: input.agent_id },
        timestamp: Date.now(),
      });
    }
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  });

  // 아티팩트 조회
  server.tool("get_artifact", {
    agent_id: z.string().describe("조회하는 에이전트 ID"),
    name: z.string().describe("조회할 아티팩트 이름"),
  }, async (input) => {
    const result = await handleGetArtifact(getDb(), SESSION_ID, input);
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  });

  // --- review 툴 등록 ---

  // 리뷰 요청
  server.tool("request_review", {
    agent_id: z.string().describe("리뷰를 요청하는 에이전트 ID"),
    artifact_id: z.string().describe("리뷰 대상 아티팩트 ID"),
    reviewer: z.string().describe("리뷰어 에이전트 ID (예: fe2, be2)"),
  }, async (input) => {
    const result = await handleRequestReview(getDb(), SESSION_ID, input);
    if (result.success && result.review_id) {
      broadcast({
        type: "review:requested",
        review: { id: result.review_id, artifact_id: input.artifact_id, reviewer: input.reviewer, requester: input.agent_id },
        timestamp: Date.now(),
      });
    }
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  });

  // 리뷰 제출
  server.tool("submit_review", {
    agent_id: z.string().describe("리뷰를 제출하는 에이전트 ID"),
    review_id: z.string().describe("리뷰 ID"),
    status: z.enum(["approved", "changes_requested"]).describe("리뷰 결과"),
    comments: z.string().optional().describe("리뷰 코멘트"),
  }, async (input) => {
    const result = await handleSubmitReview(getDb(), SESSION_ID, input);
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  });

  // --- agents 툴 등록 ---

  // 에이전트 목록 조회 (오케스트레이터가 어떤 에이전트가 있는지 파악에 사용)
  const agents = loadAgents();

  server.tool("list_agents", {}, async () => {
    return {
      content: [{
        type: "text",
        text: JSON.stringify(
          Object.values(agents).map(a => ({
            id: a.id, name: a.name, emoji: a.emoji,
            description: a.description, tools: a.tools,
          }))
        ),
      }],
    };
  });

  // 워크플로 설정 조회 (오케스트레이터가 실행 흐름 파악에 사용)
  server.tool("get_workflow", {}, async () => {
    const workflow = getWorkflow();
    return {
      content: [{ type: "text", text: JSON.stringify(workflow) }],
    };
  });

  return server;
}

export async function startMcpServer(server: McpServer): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[relay] MCP 서버 시작됨 (stdio)");
}
