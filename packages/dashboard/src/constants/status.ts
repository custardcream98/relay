// packages/dashboard/src/constants/status.ts
// Canonical task status and priority color/label constants.
// Shared across TaskBoard, TaskProgressBar, AgentDetailPanel, etc.

// Canonical column order for task statuses
export const STATUS_ORDER = ["todo", "in_progress", "in_review", "done"] as const;

// Display labels per task status
export const STATUS_LABELS: Record<string, string> = {
  todo: "todo",
  in_progress: "in progress",
  in_review: "review",
  done: "done",
};

// Status colors using CSS variables — used by TaskProgressBar segments and TaskBoard column headers.
export const STATUS_COLORS: Record<string, string> = {
  todo: "var(--color-text-disabled)",
  in_progress: "var(--color-column-in-progress)",
  in_review: "var(--color-column-in-review)",
  done: "var(--color-column-done)",
};

// Status colors as hex values — required when appending alpha suffixes (e.g. `${COLOR}18`).
// CSS vars cannot be used because `var(--foo)18` is invalid CSS.
// Used by AgentDetailPanel task tab badges.
export const STATUS_HEX_COLORS: Record<string, string> = {
  todo: "#6b7280",
  in_progress: "#60a5fa",
  in_review: "#fbbf24",
  done: "#818cf8",
};
export const STATUS_HEX_FALLBACK = "#6b7280";

// Top accent bar color per column (excluding todo) — CSS variables
export const COLUMN_ACCENT: Record<string, string | undefined> = {
  todo: undefined,
  in_progress: "var(--color-column-in-progress)",
  in_review: "var(--color-column-in-review)",
  done: "var(--color-column-done)",
};

// Left accent bar color per priority on task cards
export const PRIORITY_BAR_COLOR: Record<string, string> = {
  critical: "var(--color-priority-critical)",
  high: "var(--color-priority-high)",
  medium: "var(--color-priority-medium)",
  low: "transparent",
};
