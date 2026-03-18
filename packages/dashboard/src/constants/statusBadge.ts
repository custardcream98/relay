// packages/dashboard/src/constants/statusBadge.ts
// Badge-specific color triples (bg, text, border) for status and priority.
// Used by TaskDetailModal for pill-style badges.

interface BadgeColor {
  bg: string;
  text: string;
  border: string;
}

// Status badge colors for task detail modal (bg/text/border triples using CSS variables)
export const STATUS_BADGE_COLOR: Record<string, BadgeColor> = {
  todo: {
    bg: "var(--color-status-todo-bg)",
    text: "var(--color-status-todo-text)",
    border: "var(--color-status-todo-border)",
  },
  in_progress: {
    bg: "var(--color-status-in-progress-bg)",
    text: "var(--color-status-in-progress-text)",
    border: "var(--color-status-in-progress-border)",
  },
  in_review: {
    bg: "var(--color-status-in-review-bg)",
    text: "var(--color-status-in-review-text)",
    border: "var(--color-status-in-review-border)",
  },
  done: {
    bg: "var(--color-status-done-bg)",
    text: "var(--color-status-done-text)",
    border: "var(--color-status-done-border)",
  },
};

// Priority top border color for task detail modal
export const PRIORITY_BORDER_COLOR: Record<string, string> = {
  critical: "var(--color-priority-critical)",
  high: "var(--color-priority-high)",
  medium: "var(--color-priority-medium)",
  low: "transparent",
};

// Priority badge colors for task detail modal (bg/text/border triples)
export const PRIORITY_BADGE_COLOR: Record<string, BadgeColor> = {
  critical: {
    bg: "var(--color-priority-critical-bg)",
    text: "var(--color-priority-critical)",
    border: "var(--color-priority-critical-border)",
  },
  high: {
    bg: "var(--color-priority-high-bg)",
    text: "var(--color-priority-high)",
    border: "var(--color-priority-high-border)",
  },
  medium: {
    bg: "var(--color-priority-medium-bg)",
    text: "var(--color-priority-medium)",
    border: "var(--color-priority-medium-border)",
  },
  low: {
    bg: "var(--color-surface-overlay)",
    text: "var(--color-text-tertiary)",
    border: "var(--color-border-subtle)",
  },
};
