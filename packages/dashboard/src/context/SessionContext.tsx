// packages/dashboard/src/context/SessionContext.tsx
// Session-scoped state: tasks, messages, agent statuses, timeline, and the selected agent.

import { createContext, useContext } from "react";
import type { AgentId } from "relay-shared";
import type { AgentMeta, Message, Task, TimelineEntry } from "../types";

type AgentStatus = "idle" | "working" | "waiting" | "done";

export interface SessionContextValue {
  tasks: Task[];
  messages: Message[];
  agentStatuses: Partial<Record<AgentId, AgentStatus>>;
  thinkingChunks: Partial<Record<AgentId, string>>;
  selectedAgent: AgentId | null;
  timeline: TimelineEntry[];
  instanceId: string | undefined;
  instancePort: number | undefined;
  sessionTeam: AgentMeta[];
  totalEventCount: number;
  liveSessionId: string | null;
  onSelectAgent: (id: AgentId | null) => void;
}

export const SessionContext = createContext<SessionContextValue | null>(null);

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside SessionContext.Provider");
  return ctx;
}
