// packages/server/src/tools/register-agents.ts
// Registers list_agents, list_pool_agents, get_server_info, and broadcast_thinking
// MCP tools on the server.

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { markAsAgentId } from "relay-shared";
import { z } from "zod";
import { getAgents, getPool } from "../agents/cache.js";
import { injectLanguageDirective } from "../agents/loader.js";
import { getInstanceId, getPort, getRelayDir, getSessionId } from "../config.js";
import { shouldBroadcastStatus } from "../dashboard/status-debounce.js";
import { broadcast } from "../dashboard/websocket.js";
import { AGENT_ID_SCHEMA, SESSION_ID_SCHEMA } from "../schemas.js";
import { jsonResponse } from "../utils/mcp-response.js";

export function registerAgentTools(server: McpServer): void {
  // Returns the actual dashboard URL and server metadata.
  // Skills call this during pre-flight to discover the correct port (auto-selected 3456–3465).
  server.tool(
    "get_server_info",
    {
      agent_id: AGENT_ID_SCHEMA.describe("ID of the calling agent (for tracking)"),
    },
    async () => {
      const port = getPort();
      // When port is null the dashboard failed to bind (EADDRINUSE) — do not fabricate a URL
      const dashboardUrl = port != null ? `http://localhost:${port}` : null;
      return jsonResponse({
        success: true,
        dashboardUrl,
        dashboardAvailable: port != null,
        port,
        sessionId: getSessionId(),
        instanceId: getInstanceId() ?? null,
      });
    }
  );

  // Broadcast an agent's current thinking to the dashboard.
  // Emits two WebSocket events: agent:thinking (streaming text) and agent:status=working.
  // Call this before significant operations so the dashboard shows the agent as active.
  server.tool(
    "broadcast_thinking",
    {
      agent_id: AGENT_ID_SCHEMA.describe(
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
      // Emit agent:status=working so the dashboard marks the agent as active immediately (debounced)
      if (shouldBroadcastStatus(input.agent_id, "working")) {
        broadcast({ type: "agent:status", agentId, status: "working", timestamp });
      }
      broadcast({ type: "agent:thinking", agentId, chunk: input.content, timestamp });
      return jsonResponse({ success: true });
    }
  );

  // Lazy agent cache — populated on first list_agents call, after setProjectRoot() has been set.
  // Loading at createMcpServer() time would use CWD=/tmp (bunx behavior) and always return [].
  // Session-specific files are written once per /relay:relay run and never mutate; no TTL needed.
  server.tool(
    "list_agents",
    {
      agent_id: AGENT_ID_SCHEMA.describe("ID of the calling agent (for tracking)"),
      session_id: SESSION_ID_SCHEMA.optional().describe(
        "Session ID to scope agent loading. When provided, loads .relay/session-agents-{session_id}.yml (written by /relay:relay Team Composition)."
      ),
    },
    async (input) => {
      const agents = getAgents(input.session_id);
      // Return an explicit error when a session_id was given but the file is missing.
      // This lets the orchestrator distinguish "0 agents" from "file not yet written".
      if (agents === null) {
        const relayDir = getRelayDir();
        return jsonResponse({
          success: false,
          error: `Session agents file not found: ${relayDir}/session-agents-${input.session_id}.yml — run team composition first`,
        });
      }
      return jsonResponse({
        success: true,
        agents: Object.values(agents).map((a) => ({
          id: a.id,
          name: a.name,
          emoji: a.emoji,
          description: a.description,
          tools: a.tools,
          // Language directive is injected by injectLanguageDirective() at response time.
          systemPrompt: injectLanguageDirective(a.systemPrompt, a.language),
          basePersonaId: a.basePersonaId, // expose for dashboard agent disambiguation
          validate_prompt: a.validate_prompt,
          review_checklist: a.review_checklist,
          language: a.language,
        })),
      });
    }
  );

  // Returns all available pool agents (metadata only — no systemPrompt) for team selection
  server.tool(
    "list_pool_agents",
    {
      agent_id: AGENT_ID_SCHEMA.describe("ID of the calling agent (for tracking)"),
    },
    async () => {
      let agents: ReturnType<typeof getPool>;
      try {
        agents = getPool();
      } catch (err) {
        return jsonResponse({ success: false, error: (err as Error).message });
      }
      return jsonResponse({
        success: true,
        agents: Object.values(agents).map((a) => ({
          id: a.id,
          name: a.name,
          emoji: a.emoji,
          description: a.description,
          tags: a.tags,
          tools: a.tools,
          validate_prompt: a.validate_prompt,
          review_checklist: a.review_checklist,
          language: a.language,
          // systemPrompt intentionally omitted — pool metadata only
        })),
      });
    }
  );
}
