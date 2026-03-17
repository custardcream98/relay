// packages/server/src/dashboard/websocket.test.ts
// Tests for the WebSocket broadcast module — client management and selective DB persistence.
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { markAsAgentId } from "@custardcream/relay-shared";
import { _resetSessionId } from "../config.ts";
import { _resetStore } from "../store.ts";
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

// Maximum concurrent WebSocket connection cap (mirrors the constant in websocket.ts)
const MAX_WS_CLIENTS = 50;

describe("websocket broadcast", () => {
  // Save the original value so we always restore it even if a test throws before afterEach
  let savedSessionId: string | undefined;

  beforeEach(() => {
    savedSessionId = process.env.RELAY_SESSION_ID;
    _resetStore();
    // Use a fixed session ID so insertEvent does not rely on getSessionId auto-generate
    process.env.RELAY_SESSION_ID = "ws-test-session";
  });

  afterEach(() => {
    if (savedSessionId === undefined) {
      delete process.env.RELAY_SESSION_ID;
    } else {
      process.env.RELAY_SESSION_ID = savedSessionId;
    }
    _resetSessionId();
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

  describe("addClient 50-connection cap", () => {
    test("49th client is accepted (below cap)", () => {
      const clients = [];
      // Add 48 clients first
      for (let i = 0; i < 48; i++) {
        const ws = makeWsStub();
        clients.push(ws);
        addClient(ws as never);
      }
      // 49th client — must be accepted
      const ws49 = makeWsStub();
      clients.push(ws49);
      const accepted = addClient(ws49 as never);
      expect(accepted).toBe(true);

      // Clean up
      for (const ws of clients) removeClient(ws as never);
    });

    test("50th client is accepted (at cap boundary)", () => {
      const clients = [];
      // Add 49 clients
      for (let i = 0; i < 49; i++) {
        const ws = makeWsStub();
        clients.push(ws);
        addClient(ws as never);
      }
      // 50th client — exactly at cap, must still be accepted (size < MAX after add)
      const ws50 = makeWsStub();
      clients.push(ws50);
      const accepted = addClient(ws50 as never);
      expect(accepted).toBe(true);

      // Clean up
      for (const ws of clients) removeClient(ws as never);
    });

    test("51st client is rejected (over cap)", () => {
      const clients = [];
      // Fill up to MAX_WS_CLIENTS (50)
      for (let i = 0; i < MAX_WS_CLIENTS; i++) {
        const ws = makeWsStub();
        clients.push(ws);
        addClient(ws as never);
      }
      // 51st client must be rejected
      const wsOver = makeWsStub();
      const accepted = addClient(wsOver as never);
      expect(accepted).toBe(false);

      // Clean up
      for (const ws of clients) removeClient(ws as never);
    });

    test("after removing a client, the cap slot is freed and a new client is accepted", () => {
      const clients = [];
      // Fill up to MAX_WS_CLIENTS
      for (let i = 0; i < MAX_WS_CLIENTS; i++) {
        const ws = makeWsStub();
        clients.push(ws);
        addClient(ws as never);
      }
      // Remove one client to free a slot
      const removed = clients.pop();
      if (removed) removeClient(removed as never);

      // A new client should now be accepted
      const wsNew = makeWsStub();
      const accepted = addClient(wsNew as never);
      expect(accepted).toBe(true);

      // Clean up
      for (const ws of clients) removeClient(ws as never);
      removeClient(wsNew as never);
    });
  });
});
