// packages/server/src/dashboard/websocket.test.ts
// Tests for the WebSocket broadcast module — client management and selective DB persistence.
import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { markAsAgentId } from "@custardcream/relay-shared";
import { _resetSessionId } from "../config.ts";
import { _setDb, closeDb } from "../db/client.ts";
import { getEventsBySession } from "../db/queries/events.ts";
import { runMigrations } from "../db/schema.ts";
import type { SqliteDatabase } from "../db/types.ts";
import { addClient, broadcast, removeClient } from "./websocket";

// Minimal WebSocket stub — tracks sent messages and can simulate a broken connection.
function makeWsStub(broken = false): { send: (d: string) => void; sent: string[] } {
  const sent: string[] = [];
  return {
    sent,
    send(data: string) {
      if (broken) throw new Error("WebSocket closed");
      sent.push(data);
    },
  };
}

describe("websocket broadcast", () => {
  beforeEach(() => {
    const db = new Database(":memory:");
    runMigrations(db as unknown as SqliteDatabase);
    _setDb(db as unknown as SqliteDatabase);
    // Use a fixed session ID so insertEvent does not rely on getSessionId auto-generate
    process.env.RELAY_SESSION_ID = "ws-test-session";
  });

  afterEach(() => {
    delete process.env.RELAY_SESSION_ID;
    _resetSessionId();
    closeDb();
  });

  test("sends an event payload to all connected clients", () => {
    const client1 = makeWsStub();
    const client2 = makeWsStub();
    addClient(client1 as never);
    addClient(client2 as never);

    const event = {
      type: "agent:status" as const,
      agentId: markAsAgentId("pm"),
      status: "working" as const,
      timestamp: Date.now(),
    };
    broadcast(event);

    expect(client1.sent).toHaveLength(1);
    expect(client2.sent).toHaveLength(1);
    const parsed = JSON.parse(client1.sent[0]);
    expect(parsed.type).toBe("agent:status");

    removeClient(client1 as never);
    removeClient(client2 as never);
  });

  test("persists regular events to DB", () => {
    const client = makeWsStub();
    addClient(client as never);

    broadcast({
      type: "message:new",
      message: {
        id: "msg-1",
        from_agent: "pm",
        to_agent: null,
        content: "hello",
        thread_id: null,
        created_at: 1000,
      },
      timestamp: Date.now(),
    });

    const events = getEventsBySession("ws-test-session");
    expect(events.some((e) => e.type === "message:new")).toBe(true);

    removeClient(client as never);
  });

  test("does NOT persist agent:thinking events to DB", () => {
    const client = makeWsStub();
    addClient(client as never);

    broadcast({
      type: "agent:thinking",
      agentId: markAsAgentId("be"),
      chunk: "Thinking about implementation...",
      timestamp: Date.now(),
    });

    const events = getEventsBySession("ws-test-session");
    expect(events.every((e) => e.type !== "agent:thinking")).toBe(true);
    // But the event is still sent to the client
    expect(client.sent).toHaveLength(1);

    removeClient(client as never);
  });

  test("does NOT persist session:started events to DB", () => {
    const client = makeWsStub();
    addClient(client as never);

    broadcast({
      type: "session:started",
      sessionId: "ws-test-session",
      timestamp: Date.now(),
    });

    const events = getEventsBySession("ws-test-session");
    expect(events.every((e) => e.type !== "session:started")).toBe(true);
    // Still forwarded to client
    expect(client.sent).toHaveLength(1);

    removeClient(client as never);
  });

  test("removes a broken client and continues broadcasting to healthy clients", () => {
    const healthy = makeWsStub();
    const broken = makeWsStub(true);
    addClient(healthy as never);
    addClient(broken as never);

    // Should not throw even though broken client throws on send
    expect(() =>
      broadcast({
        type: "agent:status" as const,
        agentId: markAsAgentId("qa"),
        status: "idle" as const,
        timestamp: Date.now(),
      })
    ).not.toThrow();

    // Healthy client still received the event
    expect(healthy.sent).toHaveLength(1);

    removeClient(healthy as never);
    // broken client was auto-removed by broadcast, but removeClient is idempotent
    removeClient(broken as never);
  });
});
