// packages/server/src/dashboard/websocket.ts
import type { WebSocket } from "ws";
import { getSessionId } from "../config";
import { insertEvent } from "../db/queries/events.ts";
import type { RelayEvent } from "./events";

// 현재 세션 ID — 서버 시작 시 config.getSessionId()가 자동 생성
const SESSION_ID = getSessionId();

// Set of currently connected WebSocket clients
const clients = new Set<WebSocket>();

export function addClient(ws: WebSocket): void {
  clients.add(ws);
}

export function removeClient(ws: WebSocket): void {
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
