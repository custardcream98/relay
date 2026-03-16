// packages/server/src/tools/register-review.ts
// Registers request_review and submit_review MCP tools on the server.

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getSessionId } from "../config.js";
import { broadcast } from "../dashboard/websocket.js";
import { AGENT_ID_SCHEMA } from "../schemas.js";
import { handleRequestReview, handleSubmitReview } from "./review.js";

export function registerReviewTools(server: McpServer): void {
  // Request a peer review for a posted artifact. The reviewer agent receives a review:requested event.
  // After calling this, update the task to 'in_review' status and send the reviewer a message with the review_id.
  server.tool(
    "request_review",
    {
      agent_id: AGENT_ID_SCHEMA.describe("ID of the agent requesting the review (the author)."),
      artifact_id: z
        .string()
        .describe(
          "ID of the artifact to be reviewed. Obtain from post_artifact response (artifact_id field)."
        ),
      reviewer: z
        .string()
        .regex(/^[a-zA-Z0-9_-]+$/)
        .max(64)
        .describe(
          "ID of the agent who should perform the review (e.g. qa, be2). They will call submit_review with the returned review_id."
        ),
    },
    async (input) => {
      const result = await handleRequestReview(getSessionId(), input);
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

  // Submit a review decision. Only the assigned reviewer may call this.
  // On 'approved', the author can update the task to 'done'. On 'changes_requested', author must revise.
  server.tool(
    "submit_review",
    {
      agent_id: AGENT_ID_SCHEMA.describe(
        "ID of the reviewing agent. Must match the reviewer field set in request_review, otherwise returns permission denied."
      ),
      review_id: z.string().describe("Review ID returned by request_review."),
      status: z
        .enum(["approved", "changes_requested"])
        .describe(
          "Review outcome. 'approved' signals the work is accepted. 'changes_requested' means the author must revise."
        ),
      comments: z
        .string()
        .max(16384)
        .optional()
        .describe("Detailed review feedback. Required when status is 'changes_requested'."),
    },
    async (input) => {
      const result = await handleSubmitReview(getSessionId(), input);
      if (result.success && result.review) {
        broadcast({ type: "review:updated", review: result.review, timestamp: Date.now() });
      }
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    }
  );
}
