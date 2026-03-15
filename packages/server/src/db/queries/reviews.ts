import type { SqliteDatabase } from "../types";

export interface ReviewRow {
  id: string;
  session_id: string;
  artifact_id: string;
  reviewer: string;
  requester: string;
  status: string;
  comments: string | null;
  created_at: number;
  updated_at: number;
}

// Insert a review into the DB
export function insertReview(
  db: SqliteDatabase,
  review: Omit<ReviewRow, "created_at" | "updated_at">
): void {
  db.prepare(`
    INSERT INTO reviews (id, session_id, artifact_id, reviewer, requester, status, comments)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    review.id,
    review.session_id,
    review.artifact_id,
    review.reviewer,
    review.requester,
    review.status,
    review.comments
  );
}

// Update a review's status and comments, scoped to session to prevent cross-session writes
export function updateReviewStatus(
  db: SqliteDatabase,
  id: string,
  sessionId: string,
  status: string,
  comments: string | null
): void {
  db.prepare(`
    UPDATE reviews SET status = ?, comments = ?, updated_at = unixepoch()
    WHERE id = ? AND session_id = ?
  `).run(status, comments, id, sessionId);
}

// Look up a review by ID (used for ownership validation)
export function getReviewById(db: SqliteDatabase, id: string, sessionId: string): ReviewRow | null {
  return (
    (db.prepare("SELECT * FROM reviews WHERE id = ? AND session_id = ?").get(id, sessionId) as
      | ReviewRow
      | undefined) ?? null
  );
}

// Fetch all reviews assigned to a specific reviewer
export function getReviewsByReviewer(
  db: SqliteDatabase,
  sessionId: string,
  reviewer: string
): ReviewRow[] {
  return db
    .prepare("SELECT * FROM reviews WHERE session_id = ? AND reviewer = ? ORDER BY created_at ASC")
    .all(sessionId, reviewer) as ReviewRow[];
}
