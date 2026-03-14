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
 *
 * Note: session:started events are not persisted (intentional — they are
 * transient live signals). A session that produced no other events after
 * start_session will not appear here. This is acceptable since the XXXX
 * random suffix in the session ID is the authoritative collision guard.
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
