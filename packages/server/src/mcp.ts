// packages/server/src/mcp.ts

import { createRequire } from "node:module";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setProjectRoot, uriToPath } from "./config";
import { registerAgentTools } from "./tools/register-agents";
import { registerArtifactTools } from "./tools/register-artifacts";
import { registerMemoryTools } from "./tools/register-memory";
import { registerMessagingTools } from "./tools/register-messaging";
import { registerReviewTools } from "./tools/register-review";
import { registerSessionTools } from "./tools/register-sessions";
import { registerTaskTools } from "./tools/register-tasks";

const _require = createRequire(import.meta.url);
const { version: SERVER_VERSION } = _require("../package.json") as { version: string };

export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: "relay",
    version: SERVER_VERSION,
  });

  registerAgentTools(server);
  registerMessagingTools(server);
  registerTaskTools(server);
  registerArtifactTools(server);
  registerReviewTools(server);
  registerMemoryTools(server);
  registerSessionTools(server);

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
