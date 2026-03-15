// packages/server/src/db/queries/events.ts

import type { RelayEvent } from "@custardcream/relay-shared";
import { getDb } from "../client";

// Persist an event to the DB for history replay.
// created_at uses unixepoch() (seconds) — convert event.timestamp (ms) accordingly.
export function insertEvent(sessionId: string, event: RelayEvent): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO events (id, session_id, type, payload, agent_id, created_at) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    crypto.randomUUID(),
    sessionId,
    event.type,
    JSON.stringify(event),
    "agentId" in event ? event.agentId : null,
    Math.floor(event.timestamp / 1000) // ms → seconds (matches unixepoch() unit)
  );
}

// Fetch all events for a session in chronological order (for replay).
export function getEventsBySession(sessionId: string): RelayEvent[] {
  const db = getDb();
  const rows = db
    // Secondary sort by rowid breaks ties when multiple events share the same created_at second.
    // id is a random UUID so it is not a reliable tiebreaker by value; rowid (implicit SQLite
    // integer primary key) reflects true insertion order and is always unique.
    .prepare(`SELECT payload FROM events WHERE session_id = ? ORDER BY created_at ASC, rowid ASC`)
    .all(sessionId) as { payload: string }[];
  return rows.map((r) => JSON.parse(r.payload) as RelayEvent);
}
