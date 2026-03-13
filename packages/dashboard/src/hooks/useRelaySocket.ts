// packages/dashboard/src/hooks/useRelaySocket.ts

import type { RelayEvent } from "@custardcream/relay-shared";
import { useEffect, useRef, useState } from "react";

const WS_URL = `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/ws`;
const RECONNECT_DELAY_MS = [1000, 2000, 4000, 8000, 16000]; // exponential back-off

interface UseRelaySocketOptions {
  onEvent: (event: RelayEvent) => void;
}

export function useRelaySocket({ onEvent }: UseRelaySocketOptions): { connected: boolean } {
  const [connected, setConnected] = useState(false);
  const onEventRef = useRef(onEvent);
  const attemptRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeRef = useRef(true);

  // Keep the latest onEvent reference to avoid stale closures
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
        attemptRef.current = 0; // Reset counter on successful reconnect
      };

      socket.onmessage = (e) => {
        try {
          const event = JSON.parse(e.data) as RelayEvent;
          onEventRef.current(event);
        } catch {
          // Ignore parse errors
        }
      };

      socket.onerror = () => {
        // onclose always follows onerror, so no additional handling needed here
      };

      socket.onclose = () => {
        setConnected(false);
        if (!activeRef.current) return;

        // Exponential back-off reconnect
        const delay =
          RECONNECT_DELAY_MS[Math.min(attemptRef.current, RECONNECT_DELAY_MS.length - 1)];
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
  }, []); // Run only once on mount

  return { connected };
}
