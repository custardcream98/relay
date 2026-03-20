// packages/server/src/tools/register-memory.ts
// Registers read_memory, write_memory, and append_memory MCP tools on the server.
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { markAsAgentId } from "relay-shared";
import { z } from "zod";

import { getRelayDir } from "../config.js";
import { broadcast } from "../dashboard/websocket.js";
import { AGENT_ID_SCHEMA } from "../schemas.js";
import { jsonResponse } from "../utils/mcp-response.js";
import { handleAppendMemory, handleReadMemory, handleWriteMemory } from "./memory.js";

export function registerMemoryTools(server: McpServer): void {
  // Read agent or project memory
  server.tool(
    "read_memory",
    {
      agent_id: AGENT_ID_SCHEMA.optional().describe("Agent ID. Omit to return project.md only."),
    },
    async (input) => {
      const result = await handleReadMemory(getRelayDir(), input);
      return jsonResponse(result);
    }
  );

  // Write (overwrite) a memory section
  server.tool(
    "write_memory",
    {
      agent_id: AGENT_ID_SCHEMA.optional().describe("Agent ID. Omit to write to project.md"),
      key: z
        .string()
        .min(1)
        .max(256)
        .regex(/^[^#\n\r][^\n\r]*$/, "key must not start with '#' and must not contain newlines")
        .describe("Memory section key (e.g. conventions, api-patterns)"),
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
      return jsonResponse(result);
    }
  );

  // Append to memory (accumulate entries)
  server.tool(
    "append_memory",
    {
      agent_id: AGENT_ID_SCHEMA.describe(
        "Agent ID. Use save_session_summary for session retrospectives."
      ),
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
      return jsonResponse(result);
    }
  );
}
