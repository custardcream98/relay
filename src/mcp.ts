// src/mcp.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: "relay",
    version: "0.1.0",
  });

  // 툴은 각 Task에서 등록
  return server;
}

export async function startMcpServer(server: McpServer): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[relay] MCP 서버 시작됨 (stdio)");
}
