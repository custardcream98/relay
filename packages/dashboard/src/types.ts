// packages/dashboard/src/types.ts
// Canonical domain types for the dashboard — single source of truth

import type { AgentId, RelayEvent, TaskPriority, TaskStatus } from "relay-shared";
export type { AgentId, RelayEvent, TaskPriority, TaskStatus };

export interface Task {
  id: string;
  title: string;
  assignee: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  description?: string | null;
  // Dependency metadata — task IDs this task depends on
  depends_on?: string[];
  // Parent task ID — set when this task was derived from another task
  parent_task_id?: string | null;
  // Unix seconds — present in snapshot responses from the server
  created_at?: number;
  updated_at?: number;
}

export interface Message {
  id: string;
  from_agent: string;
  to_agent: string | null;
  content: string;
  thread_id?: string | null;
  created_at: number;
}

export interface AgentMeta {
  id: AgentId;
  name: string;
  emoji: string;
  basePersonaId?: string; // set when agent was created via `extends`
  joinedAt?: number; // Unix ms timestamp when this agent joined mid-session
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

// DashboardEvent is an alias kept for clarity
export type DashboardEvent = RelayEvent;
