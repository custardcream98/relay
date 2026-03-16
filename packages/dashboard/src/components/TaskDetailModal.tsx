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
      <div className="flex items-start gap-2 mb-[10px]">
        <span className="flex-1 text-[13px] font-medium leading-[1.45] text-[var(--color-text-primary)]">
          {task.title}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close task detail"
          className="close-btn shrink-0 w-5 h-5 flex items-center justify-center rounded border-none bg-transparent text-[var(--color-text-disabled)] cursor-pointer text-sm leading-none"
        >
          ×
        </button>
      </div>

      {/* Meta chips row */}
      <div className="flex gap-1.5 items-center mb-3 flex-wrap">
        {/* Priority badge */}
        <span
          className="text-[10px] font-mono font-medium px-[7px] py-[2px] rounded-full uppercase tracking-[0.06em]"
          style={{
            background: priorityColors.bg,
            color: priorityColors.text,
            border: `1px solid ${priorityColors.border}`,
          }}
        >
          {task.priority}
        </span>

        {/* Status badge */}
        <span
          className="text-[10px] font-mono px-[7px] py-[2px] rounded-full uppercase tracking-[0.06em]"
          style={{
            background: statusColors.bg,
            color: statusColors.text,
            border: `1px solid ${statusColors.border}`,
          }}
        >
          {task.status.replace(/_/g, " ")}
        </span>

        {/* Assignee chip */}
        {task.assignee && accentHex && (
          <span
            className="font-mono text-[10px] font-medium px-[7px] py-[2px] rounded-full"
            style={{
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
        <div className="bg-[var(--color-surface-inset)] border border-[var(--color-border-subtle)] rounded-[6px] p-[10px_12px] max-h-[240px] overflow-y-auto">
          <MarkdownContent text={task.description} />
        </div>
      ) : (
        <p className="text-xs text-[var(--color-text-disabled)] italic">No description provided.</p>
      )}

      {/* Timestamps */}
      {(task.created_at || task.updated_at) && (
        <div className="mt-[10px] flex gap-3 flex-wrap">
          {task.created_at && (
            <span className="text-[10px] font-mono text-[var(--color-text-disabled)]">
              created {new Date(task.created_at * 1000).toLocaleString()}
            </span>
          )}
          {task.updated_at && task.updated_at !== task.created_at && (
            <span className="text-[10px] font-mono text-[var(--color-text-disabled)]">
              updated {new Date(task.updated_at * 1000).toLocaleString()}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
