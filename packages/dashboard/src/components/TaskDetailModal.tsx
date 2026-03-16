// packages/dashboard/src/components/TaskDetailModal.tsx
// Task detail popover — shows full title, description, and metadata
import { useEffect, useRef } from "react";
import { getAgentAccent } from "../constants/agents";
import type { Task } from "../types";
import { MarkdownContent } from "./MarkdownContent";

// Status badge color for the detail modal
const STATUS_BADGE_COLOR: Record<string, { bg: string; text: string; border: string }> = {
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

// Priority label color for the detail modal badge
const PRIORITY_BADGE_COLOR: Record<string, { bg: string; text: string; border: string }> = {
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

export function TaskDetailModal({
  task,
  onClose,
  anchorRect,
}: {
  task: Task;
  onClose: () => void;
  anchorRect: DOMRect | null;
}) {
  const modalRef = useRef<HTMLDivElement>(null);
  const accentHex = task.assignee ? getAgentAccent(task.assignee) : null;
  const priorityColors = PRIORITY_BADGE_COLOR[task.priority] ?? PRIORITY_BADGE_COLOR.low;
  const statusColors = STATUS_BADGE_COLOR[task.status] ?? STATUS_BADGE_COLOR.todo;

  // Close on Escape or outside click
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    function handleClick(e: MouseEvent) {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("keydown", handleKey);
    // Use capture so the click registers before React synthetic events
    document.addEventListener("mousedown", handleClick, true);
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.removeEventListener("mousedown", handleClick, true);
    };
  }, [onClose]);

  // Position the popover below the anchor card if possible; otherwise above
  const popoverStyle: React.CSSProperties = {
    position: "fixed",
    width: 320,
    background: "var(--color-surface-raised)",
    border: "1px solid var(--color-border-default)",
    borderRadius: 8,
    boxShadow: "var(--shadow-modal)",
    zIndex: 200,
    padding: 16,
  };

  if (anchorRect) {
    const spaceBelow = window.innerHeight - anchorRect.bottom;
    const popoverHeight = 300; // estimated
    if (spaceBelow > popoverHeight || spaceBelow > window.innerHeight / 2) {
      popoverStyle.top = anchorRect.bottom + 6;
    } else {
      popoverStyle.bottom = window.innerHeight - anchorRect.top + 6;
    }
    // Horizontal: align to left of anchor, clamped to viewport
    const left = Math.min(anchorRect.left, window.innerWidth - 328);
    popoverStyle.left = Math.max(8, left);
  } else {
    // Fallback: centered
    popoverStyle.top = "50%";
    popoverStyle.left = "50%";
    popoverStyle.transform = "translate(-50%, -50%)";
  }

  return (
    <div
      ref={modalRef}
      style={popoverStyle}
      role="dialog"
      aria-modal="true"
      aria-label={task.title}
    >
      {/* Header row — title + close */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 10 }}>
        <span
          style={{
            flex: 1,
            fontSize: 13,
            fontWeight: 500,
            lineHeight: 1.45,
            color: "var(--color-text-primary)",
          }}
        >
          {task.title}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close task detail"
          className="close-btn"
          style={{
            flexShrink: 0,
            width: 20,
            height: 20,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 4,
            border: "none",
            background: "transparent",
            color: "var(--color-text-disabled)",
            cursor: "pointer",
            fontSize: 14,
            lineHeight: 1,
          }}
        >
          ×
        </button>
      </div>

      {/* Meta chips row */}
      <div
        style={{
          display: "flex",
          gap: 6,
          alignItems: "center",
          marginBottom: 12,
          flexWrap: "wrap",
        }}
      >
        {/* Priority badge */}
        <span
          style={{
            fontSize: 10,
            fontFamily: "var(--font-mono)",
            fontWeight: 500,
            padding: "2px 7px",
            borderRadius: 9999,
            background: priorityColors.bg,
            color: priorityColors.text,
            border: `1px solid ${priorityColors.border}`,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}
        >
          {task.priority}
        </span>

        {/* Status badge — color-coded: todo=surface, in_progress=blue, in_review=amber, done=green */}
        <span
          style={{
            fontSize: 10,
            fontFamily: "var(--font-mono)",
            padding: "2px 7px",
            borderRadius: 9999,
            background: statusColors.bg,
            color: statusColors.text,
            border: `1px solid ${statusColors.border}`,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}
        >
          {task.status.replace(/_/g, " ")}
        </span>

        {/* Assignee chip */}
        {task.assignee && accentHex && (
          <span
            className="font-mono"
            style={{
              fontSize: 10,
              fontWeight: 500,
              padding: "2px 7px",
              borderRadius: 9999,
              color: accentHex,
              background: `${accentHex}1a`,
              border: `1px solid ${accentHex}40`,
            }}
          >
            {task.assignee}
          </span>
        )}
      </div>

      {/* Full description — rendered as markdown */}
      {task.description ? (
        <div
          style={{
            background: "var(--color-surface-inset)",
            border: "1px solid var(--color-border-subtle)",
            borderRadius: 6,
            padding: "10px 12px",
            maxHeight: 240,
            overflowY: "auto",
          }}
        >
          <MarkdownContent text={task.description} />
        </div>
      ) : (
        <p
          style={{
            fontSize: 12,
            color: "var(--color-text-disabled)",
            fontStyle: "italic",
          }}
        >
          No description provided.
        </p>
      )}

      {/* Timestamps */}
      {(task.created_at || task.updated_at) && (
        <div
          style={{
            marginTop: 10,
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          {task.created_at && (
            <span
              style={{
                fontSize: 10,
                fontFamily: "var(--font-mono)",
                color: "var(--color-text-disabled)",
              }}
            >
              created {new Date(task.created_at * 1000).toLocaleString()}
            </span>
          )}
          {task.updated_at && task.updated_at !== task.created_at && (
            <span
              style={{
                fontSize: 10,
                fontFamily: "var(--font-mono)",
                color: "var(--color-text-disabled)",
              }}
            >
              updated {new Date(task.updated_at * 1000).toLocaleString()}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
