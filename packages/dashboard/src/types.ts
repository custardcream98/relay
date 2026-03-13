// packages/dashboard/src/types.ts
// Canonical domain types for the dashboard — single source of truth

import type { RelayEvent } from "@custardcream/relay-shared";

export type { AgentId, RelayEvent } from "@custardcream/relay-shared";

export type TaskStatus = "todo" | "in_progress" | "in_review" | "done";
export type TaskPriority = "critical" | "high" | "medium" | "low";

export interface Task {
  id: string;
  title: string;
  assignee: string | null;
  status: TaskStatus;
  priority: TaskPriority;
}

export interface Message {
  id: string;
  from_agent: string;
  to_agent: string | null;
  content: string;
  created_at: number;
}

export interface AgentMeta {
  id: string;
  name: string;
  emoji: string;
}

// Timeline entry for the EventTimeline display component
export interface TimelineEntry {
  id: string;
  type: RelayEvent["type"];
  agentId: string | null;
  description: string;
  detail?: string;
  timestamp: number; // ms
}
