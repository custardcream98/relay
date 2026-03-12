import type { Database } from "bun:sqlite";
import { insertReview, updateReviewStatus } from "../db/queries/reviews";
import { randomUUID } from "crypto";

export async function handleRequestReview(
  db: Database,
  sessionId: string,
  input: {
    agent_id: string;
    artifact_id: string;
    reviewer: string;
  }
) {
  const id = randomUUID();
  insertReview(db, {
    id,
    session_id: sessionId,
    artifact_id: input.artifact_id,
    reviewer: input.reviewer,
    requester: input.agent_id,
    status: "pending",
    comments: null,
  });
  return { success: true, review_id: id };
}

export async function handleSubmitReview(
  db: Database,
  sessionId: string,
  input: {
    agent_id: string;
    review_id: string;
    status: "approved" | "changes_requested";
    comments?: string;
  }
) {
  updateReviewStatus(db, input.review_id, input.status, input.comments ?? null);
  return { success: true };
}
