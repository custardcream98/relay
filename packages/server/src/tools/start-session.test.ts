// packages/server/src/tools/start-session.test.ts
// Verifies that broadcast() does not persist session:started events to the DB,
// so history replay is not affected by session resets.
import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { markAsAgentId } from "@custardcream/relay-shared";
import { _resetSessionId, setSessionId } from "../config.ts";
import { broadcast } from "../dashboard/websocket.ts";
import { _setDb, closeDb } from "../db/client.ts";
import { getEventsBySession } from "../db/queries/events.ts";
import { runMigrations } from "../db/schema.ts";
import type { SqliteDatabase } from "../db/types.ts";

describe("broadcast — session:started non-persistence", () => {
  beforeEach(() => {
    const db = new Database(":memory:");
    runMigrations(db as unknown as SqliteDatabase);
    _setDb(db as unknown as SqliteDatabase);
    setSessionId("test-session");
  });

  afterEach(() => {
    closeDb();
    _resetSessionId();
  });

  test("session:started is not written to the events DB", () => {
    broadcast({ type: "session:started", sessionId: "2026-03-14-007", timestamp: Date.now() });
    const events = getEventsBySession("test-session");
    expect(events).toHaveLength(0);
  });

  test("other event types are still persisted as normal", () => {
    broadcast({
      type: "agent:status",
      agentId: markAsAgentId("pm"),
      status: "working",
      timestamp: Date.now(),
    });
    const events = getEventsBySession("test-session");
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("agent:status");
  });
});
