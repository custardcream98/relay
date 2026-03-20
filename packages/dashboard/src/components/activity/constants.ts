// packages/dashboard/src/components/activity/constants.ts
// Shared constants for ActivityFeed sub-components
import type { TimelineEntry } from "../../types";

// Filterable event types — agent:status excluded by default (noise)
export type FilterableType = TimelineEntry["type"];

export interface FilterDef {
  type: FilterableType;
  label: string;
  icon: string;
  defaultOn: boolean;
}

export const FILTER_DEFS: FilterDef[] = [
  { type: "message:new", label: "Messages", icon: "💬", defaultOn: true },
  { type: "task:updated", label: "Tasks", icon: "✅", defaultOn: true },
  { type: "artifact:posted", label: "Artifacts", icon: "📦", defaultOn: true },
  { type: "agent:thinking", label: "Thinking", icon: "🧠", defaultOn: true },
  { type: "review:requested", label: "Review req.", icon: "🔍", defaultOn: true },
  { type: "review:updated", label: "Review result", icon: "✔", defaultOn: true },
  { type: "agent:status", label: "Status", icon: "⚡", defaultOn: false },
  { type: "agent:joined", label: "Joined", icon: "👋", defaultOn: false },
  { type: "memory:updated", label: "Memory", icon: "💾", defaultOn: false },
];

export const FILTER_STORAGE_KEY = "relay-activity-filters";

export const VALID_FILTER_TYPES = new Set<string>(FILTER_DEFS.map((f) => f.type));

// Shared row layout for message/artifact/review cards
export const ROW_BASE = "flex gap-[10px] px-4 py-[10px] border-b border-(--color-border-subtle)";
export const SLIDE_IN = "animate-[slide-in-bottom_180ms_ease-out_both]";
