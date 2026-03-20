// packages/dashboard/src/context/AgentsContext.tsx
// Agent pool state: fetched agent list from GET /api/agents, loading, and error flags.
import { createContext, useContext } from "react";

import type { AgentMeta } from "../types";

export interface AgentsContextValue {
  agents: AgentMeta[];
  agentsLoading: boolean;
  agentsError: boolean;
}

export const AgentsContext = createContext<AgentsContextValue | null>(null);

export function useAgents(): AgentsContextValue {
  const ctx = useContext(AgentsContext);
  if (!ctx) throw new Error("useAgents must be used inside AgentsContext.Provider");
  return ctx;
}
