// packages/dashboard/src/components/TaskDetailModal.tsx
// Task detail popover — shows full title, description, and metadata
import { useMemo, useRef } from "react";

import { getAgentAccent } from "../constants/agents";
import {
  PRIORITY_BADGE_COLOR,
  PRIORITY_BORDER_COLOR,
  STATUS_BADGE_COLOR,
} from "../constants/statusBadge";
import { usePopover } from "../hooks/usePopover";
import type { Task } from "../types";
import { computePopoverStyle } from "../utils/popoverPosition";
import { MarkdownContent } from "./MarkdownContent";

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

  // Close on Escape or outside click; trap focus within the modal
  usePopover(modalRef, onClose, { focusTrap: true });

  // Position the popover — mobile: bottom sheet; desktop: anchored popover
  const popoverStyle = computePopoverStyle({
    anchorRect,
    width: 340,
    maxHeight: "min(420px, 70vh)",
    borderTop: `3px solid ${priorityBorderColor}`,
  });

  return (
    <div
      ref={modalRef}
      style={popoverStyle}
      role="dialog"
      aria-modal="true"
      aria-label={task.title}
    >
      {/* Header row — title + close */}
      <div className="mb-1 flex items-start gap-2">
        <span className="flex-1 text-[13px] leading-[1.45] font-medium text-(--color-text-primary)">
          {task.title}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close task detail"
          className="close-btn flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded border-none bg-transparent text-sm leading-none text-(--color-text-disabled)"
        >
          ×
        </button>
      </div>

      {/* Task ID — muted reference */}
      <div className="mb-2">
        <span className="font-mono text-[9px] text-(--color-text-disabled) select-all">
          {task.id}
        </span>
      </div>

      {/* Meta chips row */}
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {/* Priority badge */}
        <span
          className="rounded-full px-[7px] py-[2px] font-mono text-[10px] font-medium tracking-[0.06em] uppercase"
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
          className="rounded-full px-[7px] py-[2px] font-mono text-[10px] tracking-[0.06em] uppercase"
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
            className="rounded-full px-[7px] py-[2px] font-mono text-[10px] font-medium"
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
        <div className="max-h-[200px] overflow-y-auto rounded-[6px] border border-(--color-border-subtle) bg-(--color-surface-inset) p-[10px_12px]">
          <MarkdownContent text={task.description} />
        </div>
      ) : (
        <p className="text-xs text-(--color-text-disabled) italic">No description provided.</p>
      )}

      {/* Depends on section */}
      {dependsOnTasks.length > 0 && (
        <div className="mt-3">
          <span className="mb-1.5 block text-[10px] font-medium tracking-[0.06em] text-(--color-text-disabled) uppercase">
            Depends on
          </span>
          <div className="flex flex-col gap-1">
            {dependsOnTasks.map((dep) => {
              const depStatusColors = STATUS_BADGE_COLOR[dep.status] ?? STATUS_BADGE_COLOR.todo;
              return (
                <button
                  key={dep.id}
                  type="button"
                  className="flex cursor-pointer items-center gap-1.5 rounded border border-(--color-border-subtle) bg-(--color-surface-overlay) px-2 py-1 text-left transition-[border-color] duration-100 hover:border-(--color-border-default)"
                  onClick={() => onSelectTask?.(dep)}
                >
                  <span
                    className="shrink-0 rounded-full px-[5px] py-px font-mono text-[9px] font-medium tracking-[0.05em] uppercase"
                    style={{
                      background: depStatusColors.bg,
                      color: depStatusColors.text,
                      border: `1px solid ${depStatusColors.border}`,
                    }}
                  >
                    {dep.status.replace(/_/g, " ")}
                  </span>
                  <span className="min-w-0 overflow-hidden text-[11px] text-ellipsis whitespace-nowrap text-(--color-text-secondary)">
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
          <span className="mb-1.5 block text-[10px] font-medium tracking-[0.06em] text-(--color-text-disabled) uppercase">
            Derived tasks
          </span>
          <div className="flex flex-col gap-1">
            {derivedTasks.map((child) => {
              const childStatusColors = STATUS_BADGE_COLOR[child.status] ?? STATUS_BADGE_COLOR.todo;
              return (
                <button
                  key={child.id}
                  type="button"
                  className="flex cursor-pointer items-center gap-1.5 rounded border border-(--color-border-subtle) bg-(--color-surface-overlay) px-2 py-1 text-left transition-[border-color] duration-100 hover:border-(--color-border-default)"
                  onClick={() => onSelectTask?.(child)}
                >
                  <span
                    className="shrink-0 rounded-full px-[5px] py-px font-mono text-[9px] font-medium tracking-[0.05em] uppercase"
                    style={{
                      background: childStatusColors.bg,
                      color: childStatusColors.text,
                      border: `1px solid ${childStatusColors.border}`,
                    }}
                  >
                    {child.status.replace(/_/g, " ")}
                  </span>
                  <span className="min-w-0 overflow-hidden text-[11px] text-ellipsis whitespace-nowrap text-(--color-text-secondary)">
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
        <div className="mt-3 flex flex-wrap gap-3">
          {task.created_at && (
            <span className="font-mono text-[10px] text-(--color-text-disabled)">
              created {new Date(task.created_at * 1000).toLocaleString()}
            </span>
          )}
          {task.updated_at && task.updated_at !== task.created_at && (
            <span className="font-mono text-[10px] text-(--color-text-disabled)">
              updated {new Date(task.updated_at * 1000).toLocaleString()}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
