// dashboard/src/hooks/useRelaySocket.ts
import { useEffect, useRef, useState } from "react";
import type { RelayEvent } from "../types";

export function useRelaySocket(url: string) {
  const [events, setEvents] = useState<RelayEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const ws = useRef<WebSocket | null>(null);

  useEffect(() => {
    // 로컬 변수에 캡처 — cleanup이 항상 이 effect의 소켓을 닫도록
    const socket = new WebSocket(url);
    ws.current = socket;

    socket.onopen = () => setConnected(true);
    socket.onclose = () => setConnected(false);
    socket.onmessage = (e) => {
      try {
        const event: RelayEvent = JSON.parse(e.data);
        setEvents(prev => [...prev, event]);
      } catch (err) {
        console.warn("[relay] WebSocket 메시지 파싱 실패:", err);
      }
    };

    return () => {
      socket.close();
      ws.current = null;
    };
  }, [url]);

  return { events, connected };
}
