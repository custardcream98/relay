// packages/dashboard/src/context/ConnectionContext.tsx
// WebSocket connection state: status, reconnect attempt info, and manual retry handler.
import { createContext, useContext } from "react";

export interface ConnectionContextValue {
  connected: boolean;
  reconnecting: boolean;
  maxRetriesExhausted: boolean;
  attempt: number;
  nextRetryIn: number;
  onRetryNow: () => void;
}

export const ConnectionContext = createContext<ConnectionContextValue | null>(null);

export function useConnection(): ConnectionContextValue {
  const ctx = useContext(ConnectionContext);
  if (!ctx) throw new Error("useConnection must be used inside ConnectionContext.Provider");
  return ctx;
}
