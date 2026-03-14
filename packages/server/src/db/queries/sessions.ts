// packages/server/src/db/queries/sessions.ts
import { getDb } from "../client.ts";

export interface SessionRow {
  id: string;
  created_at: number;
  event_count: number;
}

/**
 * List all sessions ordered by first event time descending.
 * Derived from the events table — no separate sessions table needed.
 */
export function getAllSessions(limit = 20): SessionRow[] {
  const db = getDb();
  return db
    .prepare(
      `
      SELECT
        session_id              AS id,
        MIN(created_at)         AS created_at,
        COUNT(*)                AS event_count
      FROM events
      GROUP BY session_id
      ORDER BY created_at DESC
      LIMIT ?
    `
    )
    .all(limit) as SessionRow[];
}
