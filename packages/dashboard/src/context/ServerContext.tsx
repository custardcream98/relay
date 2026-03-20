// packages/dashboard/src/context/ServerContext.tsx
// Multi-server management: server list, active server URL, switch and add handlers.
import { createContext, useContext } from "react";

import type { ServerEntry } from "../types";

export interface ServerContextValue {
  servers: ServerEntry[];
  activeServer: string;
  onSwitchServer: (url: string) => void;
  onAddServer: (url: string) => void;
}

export const ServerContext = createContext<ServerContextValue | null>(null);

export function useServer(): ServerContextValue {
  const ctx = useContext(ServerContext);
  if (!ctx) throw new Error("useServer must be used inside ServerContext.Provider");
  return ctx;
}
