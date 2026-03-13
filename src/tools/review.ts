import type { Database } from "bun:sqlite";
import { getReviewById, insertReview, updateReviewStatus } from "../db/queries/reviews";

export function handleRequestReview(
  db: Database,
  sessionId: string,
  input: {
    agent_id: string;
    artifact_id: string;
    reviewer: string;
  }
) {
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
}

export function handleSubmitReview(
  db: Database,
  sessionId: string,
  input: {
    agent_id: string;
    review_id: string;
    status: "approved" | "changes_requested";
    comments?: string;
  }
) {
  // 리뷰 존재 여부 및 리뷰어 소유권 검증
  const review = getReviewById(db, input.review_id, sessionId);
  if (!review) return { success: false, error: "리뷰를 찾을 수 없음" };
  if (review.reviewer !== input.agent_id) return { success: false, error: "리뷰 권한 없음" };
  updateReviewStatus(db, input.review_id, input.status, input.comments ?? null);
  return { success: true };
}
