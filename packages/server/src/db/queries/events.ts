// packages/server/src/db/queries/events.ts

import type { RelayEvent } from "@custardcream/relay-shared";
import {
  getEventsBySession as storeGetEventsBySession,
  insertEvent as storeInsertEvent,
} from "../../store";

// Persist an event to the in-memory store for history replay.
export function insertEvent(sessionId: string, event: RelayEvent): void {
  storeInsertEvent(
    sessionId,
    JSON.stringify(event),
    event.type,
    "agentId" in event ? event.agentId : null,
    event.timestamp
  );
}

// Fetch all events for a session in chronological order (for replay).
export function getEventsBySession(sessionId: string): RelayEvent[] {
  return storeGetEventsBySession(sessionId).map((payload) => JSON.parse(payload) as RelayEvent);
}
