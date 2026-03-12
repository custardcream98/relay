// src/dashboard/websocket.ts
import type { ServerWebSocket } from "bun";
import type { RelayEvent } from "./events";

// 연결된 클라이언트 집합
const clients = new Set<ServerWebSocket<unknown>>();

export function addClient(ws: ServerWebSocket<unknown>): void {
  clients.add(ws);
}

export function removeClient(ws: ServerWebSocket<unknown>): void {
  clients.delete(ws);
}

export function broadcast(event: RelayEvent): void {
  const payload = JSON.stringify(event);
  for (const client of clients) {
    try {
      client.send(payload);
    } catch {
      clients.delete(client);
    }
  }
}
