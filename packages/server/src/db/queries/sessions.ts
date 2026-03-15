// packages/server/src/db/queries/sessions.ts

import type { SessionRow } from "../../store";
import { getAllSessions as storeGetAllSessions } from "../../store";

export type { SessionRow } from "../../store";

/**
 * List all sessions ordered by first event time descending.
 * Derived from the events collection — no separate sessions table needed.
 *
 * Note: session:started events are not persisted (intentional — they are
 * transient live signals). A session that produced no other events after
 * start_session will not appear here.
 */
export function getAllSessions(limit = 20): SessionRow[] {
  return storeGetAllSessions(limit);
}
