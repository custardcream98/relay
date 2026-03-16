// packages/server/src/tools/register-artifacts.ts
// Registers post_artifact and get_artifact MCP tools on the server.

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getSessionId } from "../config.js";
import { broadcast } from "../dashboard/websocket.js";
import { AGENT_ID_SCHEMA } from "../schemas.js";
import { handleGetArtifact, handlePostArtifact } from "./artifacts.js";

export function registerArtifactTools(server: McpServer): void {
  // Store a deliverable artifact (design, PR, report, document, etc.) for the session.
  // After posting, use request_review to route it to a reviewer agent.
  server.tool(
    "post_artifact",
    {
      agent_id: AGENT_ID_SCHEMA.describe("ID of the agent posting the artifact."),
      name: z
        .string()
        .max(256)
        .describe(
          "Unique artifact name within the session (e.g. login-design, cart-fe-pr). Used by get_artifact to retrieve it."
        ),
      type: z
        .enum(["figma_spec", "pr", "report", "analytics_plan", "design", "document"])
        .describe("Artifact type. Choose the closest match to the content being stored."),
      content: z
        .string()
        .max(524288)
        .describe("Artifact content (JSON, Markdown, or plain text). Max 512 KB."),
      task_id: z
        .string()
        .max(128)
        .optional()
        .describe("ID of the task this artifact fulfills. Links the artifact to a task card."),
    },
    async (input) => {
      const result = await handlePostArtifact(getSessionId(), input);
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

  // Retrieve an artifact by name. Returns the latest artifact with the given name if multiple exist.
  server.tool(
    "get_artifact",
    {
      agent_id: AGENT_ID_SCHEMA.describe("ID of the agent fetching the artifact."),
      name: z
        .string()
        .max(256)
        .describe("Name of the artifact to retrieve. Must match the name used in post_artifact."),
    },
    async (input) => {
      const result = await handleGetArtifact(getSessionId(), input);
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    }
  );
}
