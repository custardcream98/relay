import type { Database } from "bun:sqlite";

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
  db: Database,
  review: Omit<ReviewRow, "created_at" | "updated_at">
): void {
  db.query(`
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

// Update a review's status and comments
export function updateReviewStatus(
  db: Database,
  id: string,
  status: string,
  comments: string | null
): void {
  db.query(`
    UPDATE reviews SET status = ?, comments = ?, updated_at = unixepoch()
    WHERE id = ?
  `).run(status, comments, id);
}

// Look up a review by ID (used for ownership validation)
export function getReviewById(db: Database, id: string, sessionId: string): ReviewRow | null {
  return (
    db
      .query<ReviewRow, [string, string]>("SELECT * FROM reviews WHERE id = ? AND session_id = ?")
      .get(id, sessionId) ?? null
  );
}

// Fetch all reviews assigned to a specific reviewer
export function getReviewsByReviewer(
  db: Database,
  sessionId: string,
  reviewer: string
): ReviewRow[] {
  return db
    .query<ReviewRow, [string, string]>(
      "SELECT * FROM reviews WHERE session_id = ? AND reviewer = ? ORDER BY created_at ASC"
    )
    .all(sessionId, reviewer);
}
