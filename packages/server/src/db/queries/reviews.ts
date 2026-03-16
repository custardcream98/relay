import type { ReviewRow } from "../../store";
import {
  getReviewById as storeGetReviewById,
  getReviewsByReviewer as storeGetReviewsByReviewer,
  insertReview as storeInsertReview,
  updateReviewStatus as storeUpdateReviewStatus,
} from "../../store";

export type { ReviewRow } from "../../store";

// Insert a review into the in-memory store
export function insertReview(review: Omit<ReviewRow, "created_at" | "updated_at">): void {
  storeInsertReview(review);
}

// Update a review's status and comments, scoped to session to prevent cross-session writes
export function updateReviewStatus(
  id: string,
  sessionId: string,
  status: string,
  comments: string | null
): void {
  storeUpdateReviewStatus(id, sessionId, status, comments);
}

// Look up a review by ID (used for ownership validation)
export function getReviewById(id: string, sessionId: string): ReviewRow | null {
  return storeGetReviewById(id, sessionId);
}

// Fetch all reviews assigned to a specific reviewer
export function getReviewsByReviewer(sessionId: string, reviewer: string): ReviewRow[] {
  return storeGetReviewsByReviewer(sessionId, reviewer);
}
