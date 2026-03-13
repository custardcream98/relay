// dashboard/src/hooks/useRelaySocket.ts
import { useEffect, useRef, useState } from "react";
import type { RelayEvent } from "@shared/types";

const WS_URL = `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/ws`;
const RECONNECT_DELAY_MS = [1000, 2000, 4000, 8000, 16000]; // 지수 백오프

interface UseRelaySocketOptions {
  onEvent: (event: RelayEvent) => void;
}

export function useRelaySocket({ onEvent }: UseRelaySocketOptions): { connected: boolean } {
  const [connected, setConnected] = useState(false);
  const onEventRef = useRef(onEvent);
  const attemptRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeRef = useRef(true);

  // onEvent 최신 참조 유지 (stale closure 방지)
  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    activeRef.current = true;

    function connect() {
      if (!activeRef.current) return;

      const socket = new WebSocket(WS_URL);

      socket.onopen = () => {
        if (!activeRef.current) {
          socket.close();
          return;
        }
        setConnected(true);
        attemptRef.current = 0; // 재연결 성공 시 카운터 초기화
      };

      socket.onmessage = (e) => {
        try {
          const event = JSON.parse(e.data) as RelayEvent;
          onEventRef.current(event);
        } catch {
          // 파싱 실패 무시
        }
      };

      socket.onerror = () => {
        // onclose가 항상 뒤따라오므로 여기서는 별도 처리 불필요
      };

      socket.onclose = () => {
        setConnected(false);
        if (!activeRef.current) return;

        // 지수 백오프 재연결
        const delay = RECONNECT_DELAY_MS[Math.min(attemptRef.current, RECONNECT_DELAY_MS.length - 1)];
        attemptRef.current += 1;
        timerRef.current = setTimeout(connect, delay);
      };
    }

    connect();

    return () => {
      activeRef.current = false;
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []); // 마운트 1회만 실행

  return { connected };
}
