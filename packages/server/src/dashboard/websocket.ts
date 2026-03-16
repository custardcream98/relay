// packages/server/src/dashboard/websocket.ts
import type { WebSocket } from "ws";
import { getSessionId } from "../config";
import { insertEvent } from "../store";
import type { RelayEvent } from "./events";

// Set of currently connected WebSocket clients
const clients = new Set<WebSocket>();

// Maximum concurrent WebSocket connections.
// Prevents unbounded memory growth from many open dashboard tabs or scripted clients.
const MAX_WS_CLIENTS = 50;

/** Adds a client to the broadcast set. Returns false if the cap is reached (caller should close the socket). */
export function addClient(ws: WebSocket): boolean {
  if (clients.size >= MAX_WS_CLIENTS) {
    return false;
  }
  clients.add(ws);
  return true;
}

export function removeClient(ws: WebSocket): void {
  clients.delete(ws);
}

export function broadcast(event: RelayEvent): void {
  // session:started is a transient live signal — do not persist it.
  // agent:thinking is fire-and-forget (streaming chunk) — no DB write.
  if (event.type !== "session:started" && event.type !== "agent:thinking") {
    try {
      insertEvent(
        getSessionId(),
        JSON.stringify(event),
        event.type,
        "agentId" in event ? event.agentId : null,
        event.timestamp
      );
    } catch (err) {
      // DB failure does not block broadcasting, but log the error
      console.error("[relay] failed to persist event:", err);
    }
  }
  // Forward to all live clients
  const data = JSON.stringify(event);
  for (const client of clients) {
    try {
      client.send(data);
    } catch {
      clients.delete(client);
    }
  }
}

// Heartbeat ping every 30 seconds — lets the dashboard detect stale connections.
// Clients that fail to respond (pong) within one interval are terminated and removed.
// Using a WeakSet to track liveness avoids a separate per-client interval.
const PING_INTERVAL_MS = 30_000;

// Track which clients are still alive (responded to last ping).
// Clients start as alive; set to false on ping, back to true on pong.
const alive = new WeakMap<WebSocket, boolean>();

export function markClientAlive(ws: WebSocket): void {
  alive.set(ws, true);
}

// Run the heartbeat loop.
// Call once after the WebSocket server is ready (from index.ts).
export function startHeartbeat(): NodeJS.Timeout {
  return setInterval(() => {
    for (const ws of clients) {
      if (alive.get(ws) === false) {
        // No pong received since last ping — terminate and clean up
        ws.terminate();
        clients.delete(ws);
        continue;
      }
      alive.set(ws, false);
      try {
        ws.ping();
      } catch {
        clients.delete(ws);
      }
    }
  }, PING_INTERVAL_MS);
}
