// packages/server/src/tools/start-session.test.ts
// Verifies that broadcast() does not persist session:started events to the DB,
// so history replay is not affected by session resets.
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { markAsAgentId } from "@custardcream/relay-shared";
import { _resetSessionId, setSessionId } from "../config.ts";
import { broadcast } from "../dashboard/websocket.ts";
import { _resetStore, getEventsBySession } from "../store.ts";

describe("broadcast — session:started non-persistence", () => {
  beforeEach(() => {
    _resetStore();
    setSessionId("test-session");
  });

  afterEach(() => {
    _resetSessionId();
  });

  test("session:started is not written to the events DB", () => {
    broadcast({ type: "session:started", sessionId: "2026-03-14-007", timestamp: Date.now() });
    const payloads = getEventsBySession("test-session");
    expect(payloads).toHaveLength(0);
  });

  test("other event types are still persisted as normal", () => {
    broadcast({
      type: "agent:status",
      agentId: markAsAgentId("pm"),
      status: "working",
      timestamp: Date.now(),
    });
    const payloads = getEventsBySession("test-session");
    expect(payloads).toHaveLength(1);
    const event = JSON.parse(payloads[0]) as { type: string };
    expect(event.type).toBe("agent:status");
  });
});
