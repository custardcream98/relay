// src/mcp.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { handleSendMessage, handleGetMessages } from "./tools/messaging";
import { handleCreateTask, handleUpdateTask, handleGetMyTasks } from "./tools/tasks";
import { getDb } from "./db/client";

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
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  });

  // 내 태스크 목록 조회
  server.tool("get_my_tasks", {
    agent_id: z.string().describe("조회할 에이전트 ID"),
  }, async (input) => {
    const result = await handleGetMyTasks(getDb(), SESSION_ID, input);
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  });

  return server;
}

export async function startMcpServer(server: McpServer): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[relay] MCP 서버 시작됨 (stdio)");
}
