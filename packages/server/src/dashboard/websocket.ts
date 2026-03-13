// packages/server/src/dashboard/websocket.ts
import type { ServerWebSocket } from "bun";
import { insertEvent } from "../db/queries/events.ts";
import type { RelayEvent } from "./events";

// Current session ID (injected via environment variable, defaults to "default")
const SESSION_ID = process.env.RELAY_SESSION_ID ?? "default";

// Set of currently connected WebSocket clients
const clients = new Set<ServerWebSocket<unknown>>();

export function addClient(ws: ServerWebSocket<unknown>): void {
  clients.add(ws);
}

export function removeClient(ws: ServerWebSocket<unknown>): void {
  clients.delete(ws);
}

export function broadcast(event: RelayEvent): void {
  // Persist the event to DB for history replay
  try {
    insertEvent(SESSION_ID, event);
  } catch (err) {
    // DB failure does not block broadcasting, but log the error
    console.error("[relay] failed to persist event:", err);
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
