// packages/server/src/dashboard/websocket.ts
import type { WebSocket } from "ws";
import { getSessionId } from "../config";
import { insertEvent } from "../db/queries/events";
import type { RelayEvent } from "./events";

// Set of currently connected WebSocket clients
const clients = new Set<WebSocket>();

export function addClient(ws: WebSocket): void {
  clients.add(ws);
}

export function removeClient(ws: WebSocket): void {
  clients.delete(ws);
}

export function broadcast(event: RelayEvent): void {
  // session:started resets the active session — do not persist it so history replay is unaffected.
  // agent:thinking is fire-and-forget (streaming chunk) — spec says no DB write.
  if (event.type !== "session:started" && event.type !== "agent:thinking") {
    try {
      insertEvent(getSessionId(), event);
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
