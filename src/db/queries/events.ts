// src/db/queries/events.ts

import type { RelayEvent } from "../../../shared/types.ts";
import { getDb } from "../client.ts";

// 이벤트를 DB에 저장 (히스토리 재생용)
export function insertEvent(sessionId: string, event: RelayEvent): void {
  const db = getDb();
  db.run(
    `INSERT INTO events (id, session_id, type, payload, agent_id, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
    [
      crypto.randomUUID(),
      sessionId,
      event.type,
      JSON.stringify(event),
      "agentId" in event ? event.agentId : null,
      event.timestamp,
    ]
  );
}

// 세션의 모든 이벤트 조회 (재생용)
export function getEventsBySession(sessionId: string): RelayEvent[] {
  const db = getDb();
  const rows = db
    .query(`SELECT payload FROM events WHERE session_id = ? ORDER BY created_at ASC`)
    .all(sessionId) as { payload: string }[];
  return rows.map((r) => JSON.parse(r.payload) as RelayEvent);
}
