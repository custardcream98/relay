// dashboard/src/hooks/useRelaySocket.ts
import { useEffect, useRef, useState } from "react";
import type { RelayEvent } from "../types";

export function useRelaySocket(url: string) {
  const [events, setEvents] = useState<RelayEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const ws = useRef<WebSocket | null>(null);

  useEffect(() => {
    ws.current = new WebSocket(url);

    ws.current.onopen = () => setConnected(true);
    ws.current.onclose = () => setConnected(false);
    ws.current.onmessage = (e) => {
      try {
        const event: RelayEvent = JSON.parse(e.data) as RelayEvent;
        setEvents((prev) => [...prev, event]);
      } catch (err) {
        console.warn("[relay] WebSocket 메시지 파싱 실패:", err);
      }
    };

    return () => ws.current?.close();
  }, [url]);

  return { events, connected };
}
