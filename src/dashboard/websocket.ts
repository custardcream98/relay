// src/dashboard/websocket.ts
import type { ServerWebSocket } from "bun";
import { insertEvent } from "../db/queries/events.ts";
import type { RelayEvent } from "./events";

// 현재 세션 ID (환경변수로 주입, 기본값 "default")
const SESSION_ID = process.env.RELAY_SESSION_ID ?? "default";

// 연결된 클라이언트 집합
const clients = new Set<ServerWebSocket<unknown>>();

export function addClient(ws: ServerWebSocket<unknown>): void {
  clients.add(ws);
}

export function removeClient(ws: ServerWebSocket<unknown>): void {
  clients.delete(ws);
}

export function broadcast(event: RelayEvent): void {
  // 이벤트 DB 저장 (히스토리 재생용)
  try {
    insertEvent(SESSION_ID, event);
  } catch (err) {
    // DB 저장 실패는 브로드캐스트를 막지 않지만 로그 기록
    console.error("[relay] events 저장 실패:", err);
  }
  // 라이브 클라이언트에 전송
  const data = JSON.stringify(event);
  for (const client of clients) {
    try {
      client.send(data);
    } catch {
      clients.delete(client);
    }
  }
}
