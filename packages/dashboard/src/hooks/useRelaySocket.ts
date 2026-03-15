// packages/dashboard/src/hooks/useRelaySocket.ts

import type { RelayEvent } from "@custardcream/relay-shared";
import { useCallback, useEffect, useRef, useState } from "react";

const DEFAULT_WS_URL = `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/ws`;
const RECONNECT_DELAY_MS = [1000, 2000, 4000, 8000, 16000]; // exponential back-off

// Convert an HTTP(S) server URL to the corresponding WebSocket URL
function toWsUrl(serverUrl: string): string {
  try {
    const parsed = new URL(serverUrl);
    const wsProtocol = parsed.protocol === "https:" ? "wss:" : "ws:";
    return `${wsProtocol}//${parsed.host}/ws`;
  } catch {
    return DEFAULT_WS_URL;
  }
}

interface UseRelaySocketOptions {
  onEvent: (event: RelayEvent) => void;
  // Optional: connect to a specific relay server instead of the current origin.
  // Pass an HTTP(S) URL (e.g. "http://localhost:3457") — the hook derives the WS URL.
  serverUrl?: string;
}

interface UseRelaySocketResult {
  connected: boolean;
  reconnecting: boolean; // waiting to reconnect
  attempt: number; // current attempt index (0-indexed)
  nextRetryIn: number; // seconds until next reconnect attempt
  retryNow: () => void; // trigger an immediate reconnect
}

// Type guard: checks if an incoming WebSocket message is a RelayEvent
function isRelayEvent(v: unknown): v is RelayEvent {
  return (
    typeof v === "object" &&
    v !== null &&
    "type" in v &&
    typeof (v as Record<string, unknown>).type === "string"
  );
}

export function useRelaySocket({
  onEvent,
  serverUrl,
}: UseRelaySocketOptions): UseRelaySocketResult {
  const [connected, setConnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [nextRetryIn, setNextRetryIn] = useState(0);

  const onEventRef = useRef(onEvent);
  const attemptRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeRef = useRef(true);
  // connectRef: reference to the connect function, used by retryNow
  const connectRef = useRef<(() => void) | null>(null);
  // socketRef: tracks the active WebSocket so it can be explicitly closed on cleanup
  const socketRef = useRef<WebSocket | null>(null);

  // Keep the latest onEvent reference to avoid stale closures
  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  // Clear the countdown interval helper
  const clearCountdown = useCallback(() => {
    if (countdownRef.current !== null) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  }, []);

  // Derived WebSocket URL — recalculated whenever serverUrl changes
  const wsUrl = serverUrl ? toWsUrl(serverUrl) : DEFAULT_WS_URL;

  useEffect(() => {
    activeRef.current = true;
    // Reset reconnect attempt counter when the target server changes
    attemptRef.current = 0;
    setAttempt(0);
    setConnected(false);
    setReconnecting(false);

    function connect() {
      if (!activeRef.current) return;

      // Clear any in-progress countdown before (re)connecting
      clearCountdown();
      setReconnecting(false);

      const socket = new WebSocket(wsUrl);
      socketRef.current = socket;

      socket.onopen = () => {
        if (!activeRef.current) {
          socket.close();
          return;
        }
        setConnected(true);
        setReconnecting(false);
        setNextRetryIn(0);
        attemptRef.current = 0;
        setAttempt(0);
      };

      socket.onmessage = (e) => {
        try {
          const parsed: unknown = JSON.parse(e.data);
          if (isRelayEvent(parsed)) {
            onEventRef.current(parsed);
          }
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
        const currentAttempt = attemptRef.current;
        attemptRef.current += 1;
        setAttempt(currentAttempt);
        setReconnecting(true);

        // Countdown: decrement nextRetryIn every second
        const delaySec = Math.ceil(delay / 1000);
        setNextRetryIn(delaySec);
        countdownRef.current = setInterval(() => {
          setNextRetryIn((prev) => {
            if (prev <= 1) {
              if (countdownRef.current !== null) clearInterval(countdownRef.current);
              countdownRef.current = null;
              return 0;
            }
            return prev - 1;
          });
        }, 1000);

        timerRef.current = setTimeout(connect, delay);
      };

      // Update connectRef so retryNow always calls the latest connect closure
      connectRef.current = connect;
    }

    connectRef.current = connect;
    connect();

    return () => {
      activeRef.current = false;
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      clearCountdown();
      // Explicitly close the active socket to prevent ghost reconnect after serverUrl change
      if (socketRef.current !== null) {
        socketRef.current.close();
        socketRef.current = null;
      }
    };
    // Re-run when the target WebSocket URL changes (server switch)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clearCountdown, wsUrl]);

  // Immediately trigger a reconnect attempt, cancelling any pending timer
  const retryNow = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    clearCountdown();
    setNextRetryIn(0);
    connectRef.current?.();
  }, [clearCountdown]);

  return { connected, reconnecting, attempt, nextRetryIn, retryNow };
}
