// packages/dashboard/src/components/TaskDetailModal.tsx
// Task detail popover — shows full title, description, and metadata
import { useEffect, useMemo, useRef } from "react";
import { getAgentAccent } from "../constants/agents";
import type { Task } from "../types";
import { MarkdownContent } from "./MarkdownContent";

// CSS selector for all natively focusable elements
const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

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

// Priority top border color
const PRIORITY_BORDER_COLOR: Record<string, string> = {
  critical: "var(--color-priority-critical)",
  high: "var(--color-priority-high)",
  medium: "var(--color-priority-medium)",
  low: "transparent",
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
  allTasks = [],
  onSelectTask,
}: {
  task: Task;
  onClose: () => void;
  anchorRect: DOMRect | null;
  allTasks?: Task[];
  onSelectTask?: (task: Task) => void;
}) {
  const modalRef = useRef<HTMLDivElement>(null);
  const accentHex = task.assignee ? getAgentAccent(task.assignee) : null;
  const priorityColors = PRIORITY_BADGE_COLOR[task.priority] ?? PRIORITY_BADGE_COLOR.low;
  const statusColors = STATUS_BADGE_COLOR[task.status] ?? STATUS_BADGE_COLOR.todo;
  const priorityBorderColor = PRIORITY_BORDER_COLOR[task.priority] ?? "transparent";

  // Compute dependency info
  const dependsOnTasks = useMemo(() => {
    if (!task.depends_on || task.depends_on.length === 0 || allTasks.length === 0) return [];
    const taskMap = new Map(allTasks.map((t) => [t.id, t]));
    return task.depends_on.map((id) => taskMap.get(id)).filter((t): t is Task => t !== undefined);
  }, [task.depends_on, allTasks]);

  const derivedTasks = useMemo(() => {
    if (allTasks.length === 0) return [];
    return allTasks.filter((t) => t.parent_task_id === task.id);
  }, [task.id, allTasks]);

  // Detect mobile viewport
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

  // Close on Escape or outside click; trap focus within the modal
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      // Focus trap: keep Tab / Shift+Tab cycling within the modal
      if (e.key === "Tab" && modalRef.current) {
        const focusable = Array.from(
          modalRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
        );
        if (focusable.length === 0) {
          e.preventDefault();
          return;
        }
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    }
    function handleClick(e: MouseEvent) {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("keydown", handleKey);
    // Use capture so the click registers before React synthetic events
    document.addEventListener("mousedown", handleClick, true);

    // Move focus into the modal on mount so screen readers announce it
    const firstFocusable = modalRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    firstFocusable?.focus();

    return () => {
      document.removeEventListener("keydown", handleKey);
      document.removeEventListener("mousedown", handleClick, true);
    };
  }, [onClose]);

  // Position the popover — mobile: bottom sheet; desktop: anchored popover
  const popoverStyle: React.CSSProperties = {
    position: "fixed",
    background: "var(--color-surface-raised)",
    border: "1px solid var(--color-border-default)",
    boxShadow: "var(--shadow-modal)",
    zIndex: 200,
    padding: 16,
    borderTop: `3px solid ${priorityBorderColor}`,
    animation: "task-modal-open 150ms ease-out both",
  };

  if (isMobile) {
    // Bottom sheet on mobile
    popoverStyle.bottom = 0;
    popoverStyle.left = 0;
    popoverStyle.right = 0;
    popoverStyle.width = "100%";
    popoverStyle.maxHeight = "70vh";
    popoverStyle.borderRadius = "12px 12px 0 0";
    popoverStyle.overflowY = "auto";
  } else {
    popoverStyle.width = 340;
    popoverStyle.maxHeight = "min(420px, 70vh)";
    popoverStyle.overflowY = "auto";
    popoverStyle.borderRadius = 8;

    if (anchorRect) {
      const spaceBelow = window.innerHeight - anchorRect.bottom;
      const popoverHeight = 360;
      if (spaceBelow > popoverHeight || spaceBelow > window.innerHeight / 2) {
        popoverStyle.top = anchorRect.bottom + 6;
      } else {
        popoverStyle.bottom = window.innerHeight - anchorRect.top + 6;
      }
      const left = Math.min(anchorRect.left, window.innerWidth - 348);
      popoverStyle.left = Math.max(8, left);
    } else {
      popoverStyle.top = "50%";
      popoverStyle.left = "50%";
      popoverStyle.transform = "translate(-50%, -50%)";
    }
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
      <div className="flex items-start gap-2 mb-1">
        <span className="flex-1 text-[13px] font-medium leading-[1.45] text-(--color-text-primary)">
          {task.title}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close task detail"
          className="close-btn shrink-0 w-5 h-5 flex items-center justify-center rounded border-none bg-transparent text-(--color-text-disabled) cursor-pointer text-sm leading-none"
        >
          ×
        </button>
      </div>

      {/* Task ID — muted reference */}
      <div className="mb-2">
        <span className="text-[9px] font-mono text-(--color-text-disabled) select-all">
          {task.id}
        </span>
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
        <div className="bg-(--color-surface-inset) border border-(--color-border-subtle) rounded-[6px] p-[10px_12px] max-h-[200px] overflow-y-auto">
          <MarkdownContent text={task.description} />
        </div>
      ) : (
        <p className="text-xs text-(--color-text-disabled) italic">No description provided.</p>
      )}

      {/* Depends on section */}
      {dependsOnTasks.length > 0 && (
        <div className="mt-3">
          <span className="text-[10px] font-medium text-(--color-text-disabled) uppercase tracking-[0.06em] mb-1.5 block">
            Depends on
          </span>
          <div className="flex flex-col gap-1">
            {dependsOnTasks.map((dep) => {
              const depStatusColors = STATUS_BADGE_COLOR[dep.status] ?? STATUS_BADGE_COLOR.todo;
              return (
                <button
                  key={dep.id}
                  type="button"
                  className="flex items-center gap-1.5 px-2 py-1 rounded bg-(--color-surface-overlay) border border-(--color-border-subtle) text-left cursor-pointer hover:border-(--color-border-default) transition-[border-color] duration-100"
                  onClick={() => onSelectTask?.(dep)}
                >
                  <span
                    className="text-[9px] font-mono font-medium px-[5px] py-px rounded-full uppercase tracking-[0.05em] shrink-0"
                    style={{
                      background: depStatusColors.bg,
                      color: depStatusColors.text,
                      border: `1px solid ${depStatusColors.border}`,
                    }}
                  >
                    {dep.status.replace(/_/g, " ")}
                  </span>
                  <span className="text-[11px] text-(--color-text-secondary) overflow-hidden text-ellipsis whitespace-nowrap min-w-0">
                    {dep.title}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Derived tasks section */}
      {derivedTasks.length > 0 && (
        <div className="mt-3">
          <span className="text-[10px] font-medium text-(--color-text-disabled) uppercase tracking-[0.06em] mb-1.5 block">
            Derived tasks
          </span>
          <div className="flex flex-col gap-1">
            {derivedTasks.map((child) => {
              const childStatusColors = STATUS_BADGE_COLOR[child.status] ?? STATUS_BADGE_COLOR.todo;
              return (
                <button
                  key={child.id}
                  type="button"
                  className="flex items-center gap-1.5 px-2 py-1 rounded bg-(--color-surface-overlay) border border-(--color-border-subtle) text-left cursor-pointer hover:border-(--color-border-default) transition-[border-color] duration-100"
                  onClick={() => onSelectTask?.(child)}
                >
                  <span
                    className="text-[9px] font-mono font-medium px-[5px] py-px rounded-full uppercase tracking-[0.05em] shrink-0"
                    style={{
                      background: childStatusColors.bg,
                      color: childStatusColors.text,
                      border: `1px solid ${childStatusColors.border}`,
                    }}
                  >
                    {child.status.replace(/_/g, " ")}
                  </span>
                  <span className="text-[11px] text-(--color-text-secondary) overflow-hidden text-ellipsis whitespace-nowrap min-w-0">
                    {child.title}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Timestamps */}
      {(task.created_at || task.updated_at) && (
        <div className="mt-3 flex gap-3 flex-wrap">
          {task.created_at && (
            <span className="text-[10px] font-mono text-(--color-text-disabled)">
              created {new Date(task.created_at * 1000).toLocaleString()}
            </span>
          )}
          {task.updated_at && task.updated_at !== task.created_at && (
            <span className="text-[10px] font-mono text-(--color-text-disabled)">
              updated {new Date(task.updated_at * 1000).toLocaleString()}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
