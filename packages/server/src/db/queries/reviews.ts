import type { ReviewRow } from "../../store";
import {
  getReviewById as storeGetReviewById,
  getReviewsByReviewer as storeGetReviewsByReviewer,
  insertReview as storeInsertReview,
  updateReviewStatus as storeUpdateReviewStatus,
} from "../../store";
import type { SqliteDatabase } from "../types";

export type { ReviewRow } from "../../store";

// Insert a review into the in-memory store
export function insertReview(
  _db: SqliteDatabase,
  review: Omit<ReviewRow, "created_at" | "updated_at">
): void {
  storeInsertReview(review);
}

// Update a review's status and comments, scoped to session to prevent cross-session writes
export function updateReviewStatus(
  _db: SqliteDatabase,
  id: string,
  sessionId: string,
  status: string,
  comments: string | null
): void {
  storeUpdateReviewStatus(id, sessionId, status, comments);
}

// Look up a review by ID (used for ownership validation)
export function getReviewById(
  _db: SqliteDatabase,
  id: string,
  sessionId: string
): ReviewRow | null {
  return storeGetReviewById(id, sessionId);
}

// Fetch all reviews assigned to a specific reviewer
export function getReviewsByReviewer(
  _db: SqliteDatabase,
  sessionId: string,
  reviewer: string
): ReviewRow[] {
  return storeGetReviewsByReviewer(sessionId, reviewer);
}
