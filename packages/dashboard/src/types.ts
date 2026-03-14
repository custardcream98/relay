// packages/dashboard/src/types.ts
// Canonical domain types for the dashboard — single source of truth

import type { AgentId, RelayEvent } from "@custardcream/relay-shared";
export type { AgentId, RelayEvent };

export type TaskStatus = "todo" | "in_progress" | "in_review" | "done";
export type TaskPriority = "critical" | "high" | "medium" | "low";

export interface Task {
  id: string;
  title: string;
  assignee: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  description?: string | null;
  // Unix seconds — present in snapshot responses from the server
  created_at?: number;
  updated_at?: number;
}

export interface Message {
  id: string;
  from_agent: string;
  to_agent: string | null;
  content: string;
  created_at: number;
}

export interface AgentMeta {
  id: AgentId;
  name: string;
  emoji: string;
}

// Timeline entry for the EventTimeline display component
export interface TimelineEntry {
  id: string;
  type: RelayEvent["type"] | "team:composed";
  agentId: string | null;
  description: string;
  detail?: string;
  timestamp: number; // ms
}

// Pool agent — from /api/pool-agents or agents.pool.yml
export interface PoolAgent {
  id: AgentId;
  name: string;
  emoji: string;
  description: string;
  tags: string[];
  inCurrentSession: boolean;
}

// Server entry — from /api/servers (multi-server support)
export interface ServerEntry {
  url: string;
  label: string;
  status: "live" | "offline" | "connecting";
  isActive: boolean;
}

// team:composed WS event (extended beyond shared package until BE ships it)
export interface TeamComposedEvent {
  type: "team:composed";
  agents: Array<{ id: string; name: string; emoji: string }>;
  timestamp: number;
}

// Extended event union that includes dashboard-only events
export type DashboardEvent = RelayEvent | TeamComposedEvent;
