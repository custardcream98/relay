import { getReviewById, insertReview, updateReviewStatus } from "../db/queries/reviews";
import type { SqliteDatabase } from "../db/types";

export function handleRequestReview(
  db: SqliteDatabase,
  sessionId: string,
  input: {
    agent_id: string;
    artifact_id: string;
    reviewer: string;
  }
) {
  try {
    const id = crypto.randomUUID();
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
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

export function handleSubmitReview(
  db: SqliteDatabase,
  sessionId: string,
  input: {
    agent_id: string;
    review_id: string;
    status: "approved" | "changes_requested";
    comments?: string;
  }
) {
  try {
    // Verify the review exists and that the caller is the assigned reviewer
    const review = getReviewById(db, input.review_id, sessionId);
    if (!review) return { success: false, error: "review not found" };
    if (review.reviewer !== input.agent_id)
      return { success: false, error: "permission denied: not the assigned reviewer" };
    // Prevent double-submit — only allow submitting when the review is still pending
    if (review.status !== "pending")
      return {
        success: false,
        error: `Review already submitted — status is ${review.status}`,
      };
    updateReviewStatus(db, input.review_id, sessionId, input.status, input.comments ?? null);
    const updated = getReviewById(db, input.review_id, sessionId);
    // Re-fetch should always succeed — if it fails, surface an error rather than returning success:true with null review
    if (!updated) {
      return { success: false, error: "Review updated but could not be re-fetched" };
    }
    return {
      success: true,
      review: {
        id: updated.id,
        status: updated.status as "approved" | "changes_requested",
        reviewer: updated.reviewer,
        comments: updated.comments,
      },
    };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}
