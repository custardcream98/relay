// packages/server/src/tools/register-sessions.ts
// Registers save_session_summary, list_sessions, get_session_summary, start_session,
// save_orchestrator_state, and get_orchestrator_state MCP tools on the server.

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getRelayDir, getSessionId, setSessionId } from "../config.js";
import { broadcast } from "../dashboard/websocket.js";
import { AGENT_ID_SCHEMA } from "../schemas.js";
import {
  handleGetOrchestratorState,
  handleGetSessionSummary,
  handleListSessions,
  handleSaveOrchestratorState,
  handleSaveSessionSummary,
} from "./sessions.js";

export function registerSessionTools(server: McpServer): void {
  // Declares the active session ID for this relay run.
  // Call once at the start of each /relay:relay invocation — before any other tools.
  // All subsequent tool calls in this process will use the given session ID.
  // Also broadcasts session:started to reset the live dashboard view.
  server.tool(
    "start_session",
    {
      agent_id: AGENT_ID_SCHEMA.describe("ID of the calling agent (for tracking)"),
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

  // Save a session summary (call at session end)
  server.tool(
    "save_session_summary",
    {
      agent_id: AGENT_ID_SCHEMA.describe("ID of the calling agent (typically the orchestrator)"),
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
      agent_id: AGENT_ID_SCHEMA.describe("ID of the calling agent"),
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
      agent_id: AGENT_ID_SCHEMA.describe("ID of the calling agent"),
      session_id: z
        .string()
        .regex(/^[a-zA-Z0-9_-]+$/)
        .max(128)
        .describe("ID of the session to retrieve"),
    },
    async (input) => {
      const result = await handleGetSessionSummary(getRelayDir(), {
        session_id: input.session_id,
      });
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    }
  );

  // Save the orchestrator's event loop state (survives context compaction within a process)
  server.tool(
    "save_orchestrator_state",
    {
      agent_id: AGENT_ID_SCHEMA.describe("ID of the calling agent (typically the orchestrator)"),
      state: z
        .string()
        .max(65536)
        .describe(
          "JSON-stringified event loop state. The server stores this opaque string and returns it via get_orchestrator_state. The orchestrator defines its own schema — see SKILL.md for the recommended shape."
        ),
    },
    async (input) => {
      const result = handleSaveOrchestratorState(getSessionId(), input);
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    }
  );

  // Retrieve the orchestrator's previously saved event loop state
  server.tool(
    "get_orchestrator_state",
    {
      agent_id: AGENT_ID_SCHEMA.describe("ID of the calling agent (typically the orchestrator)"),
    },
    async (input) => {
      const result = handleGetOrchestratorState(getSessionId(), input);
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    }
  );
}
