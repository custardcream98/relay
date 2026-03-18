// packages/server/src/tools/register-messaging.ts
// Registers send_message and get_messages MCP tools on the server.

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getSessionId } from "../config.js";
import { broadcast } from "../dashboard/websocket.js";
import { AGENT_ID_SCHEMA, GENERIC_ID_SCHEMA } from "../schemas.js";
import { jsonResponse } from "../utils/mcp-response.js";
import { handleGetMessages, handleSendMessage } from "./messaging.js";

export function registerMessagingTools(server: McpServer): void {
  // Send a message from one agent to another (or broadcast to all agents)
  server.tool(
    "send_message",
    {
      agent_id: AGENT_ID_SCHEMA.describe(
        "ID of the sending agent (e.g. pm, fe, be, qa). Must be alphanumeric, hyphen, or underscore."
      ),
      to: AGENT_ID_SCHEMA.nullable()
        .optional()
        .describe(
          "ID of the recipient agent. Set to null or omit to broadcast to all agents in the session."
        ),
      content: z.string().max(65536).describe("Message content (plain text or Markdown)."),
      thread_id: GENERIC_ID_SCHEMA.optional().describe(
        "Thread ID to group related messages (e.g. a task ID or review ID). Optional."
      ),
      metadata: z
        .record(z.string().max(64), z.string().max(1024))
        .refine((obj) => Object.keys(obj).length <= 20, { message: "metadata: max 20 keys" })
        .optional()
        .describe(
          "Optional key-value pairs for structured context (e.g. { task_id: 'abc', severity: 'high' }). Values must be strings."
        ),
    },
    async (input) => {
      const result = await handleSendMessage(getSessionId(), input);
      if (result.success) {
        // Strip internal fields (session_id, seq) — they are not part of the public message:new event contract
        const { id, from_agent, to_agent, content, thread_id, metadata, created_at } =
          result.message;
        broadcast({
          type: "message:new",
          message: { id, from_agent, to_agent, content, thread_id, metadata, created_at },
          timestamp: Date.now(),
        });
      }
      return jsonResponse(result);
    }
  );

  // Retrieve messages received by an agent — includes direct messages and broadcasts, excluding own broadcasts.
  server.tool(
    "get_messages",
    {
      agent_id: AGENT_ID_SCHEMA.describe(
        "ID of the agent fetching messages. Returns messages addressed to this agent plus all broadcasts (excluding own)."
      ),
      after_seq: z
        .number()
        .int()
        .optional()
        .describe(
          "Sequence cursor. When provided, only messages with seq greater than this value are returned. Pass the seq of your last received message to fetch only new messages and avoid re-reading the full history."
        ),
    },
    async (input) => {
      const result = await handleGetMessages(getSessionId(), input);
      return jsonResponse(result);
    }
  );
}
