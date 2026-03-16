// packages/dashboard/src/components/TaskBoard.tsx
import { memo, useCallback, useMemo, useState } from "react";
import { getAgentAccent } from "../constants/agents";
import { cn } from "../lib/cn";
import type { Task } from "../types";
import { TaskDetailModal } from "./TaskDetailModal";

const COLUMNS = ["todo", "in_progress", "in_review", "done"] as const;
const COLUMN_LABELS: Record<string, string> = {
  todo: "Todo",
  in_progress: "In Progress",
  in_review: "In Review",
  done: "Done",
};

// Top accent bar color per column (excluding todo) — references CSS variables
const COLUMN_ACCENT: Record<string, string | undefined> = {
  todo: undefined,
  in_progress: "var(--color-column-in-progress)",
  in_review: "var(--color-column-in-review)",
  done: "var(--color-column-done)",
};

// Left accent bar color per priority
const PRIORITY_BAR_COLOR: Record<string, string> = {
  critical: "var(--color-priority-critical)",
  high: "var(--color-priority-high)",
  medium: "var(--color-priority-medium)",
  low: "transparent",
};

// ─── TaskCard ────────────────────────────────────────────────────────────────

interface TaskCardProps {
  task: Task;
  isSelected: boolean;
  onClick: (task: Task, e: React.MouseEvent<HTMLButtonElement>) => void;
}

const TaskCard = memo(function TaskCard({ task, isSelected, onClick }: TaskCardProps) {
  const isDone = task.status === "done";
  const priorityBarColor = PRIORITY_BAR_COLOR[task.priority] ?? "transparent";
  const accentHex = task.assignee ? getAgentAccent(task.assignee) : null;
  const showPriorityLabel = task.priority === "critical" || task.priority === "high";

  return (
    <button
      type="button"
      className={cn(
        "task-card relative overflow-hidden w-full text-left shrink-0 rounded-[6px] cursor-pointer transition-[background,border-color,box-shadow] duration-100",
        "pl-[14px] pr-[10px] py-2 font-[inherit] text-inherit",
        isDone && "opacity-[0.45]",
        isSelected
          ? "bg-[var(--color-surface-overlay)] border border-[var(--color-border-default)] shadow-[var(--shadow-card-hover)]"
          : "bg-[var(--color-surface-raised)] border border-[var(--color-border-subtle)] shadow-[var(--shadow-card)]"
      )}
      aria-label={`Task: ${task.title}. Click to view details.`}
      aria-expanded={isSelected}
      onClick={(e) => onClick(task, e)}
    >
      {/* Left priority accent bar */}
      <span
        className="absolute left-0 top-1 bottom-1 w-[2px] rounded-[1px]"
        style={{ background: priorityBarColor }}
      />

      {/* Task title */}
      <span
        className={cn(
          "text-[13px] font-normal leading-[1.45] block",
          isDone
            ? "text-[var(--color-text-tertiary)] line-through"
            : "text-[var(--color-text-primary)]"
        )}
      >
        {task.title}
      </span>

      {/* Description preview — 2-line clamp */}
      {task.description && (
        <p
          className="text-[11px] leading-[1.5] text-[var(--color-text-tertiary)] mt-1 overflow-hidden break-words"
          style={{
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
          }}
        >
          {task.description}
        </p>
      )}

      {/* Meta row — assignee chip + priority label */}
      {(task.assignee || showPriorityLabel) && (
        <div className="mt-1.5 flex flex-row gap-1.5 items-center">
          {/* Assignee chip */}
          {task.assignee && accentHex && (
            <span
              className="font-mono text-[11px] font-medium px-1.5 py-[1px] rounded-[3px]"
              style={{
                color: accentHex,
                background: `${accentHex}1a`,
              }}
            >
              {task.assignee}
            </span>
          )}
          {/* critical/high priority label */}
          {showPriorityLabel && (
            <span className="font-mono text-[11px] text-[var(--color-text-secondary)]">
              {task.priority}
            </span>
          )}
        </div>
      )}
    </button>
  );
});

// ─── TaskColumn ───────────────────────────────────────────────────────────────

interface TaskColumnProps {
  col: (typeof COLUMNS)[number];
  tasks: Task[];
  onCardClick: (task: Task, e: React.MouseEvent<HTMLButtonElement>) => void;
  selectedTaskId: string | null;
}

const TaskColumn = memo(function TaskColumn({
  col,
  tasks,
  onCardClick,
  selectedTaskId,
}: TaskColumnProps) {
  const accentColor = COLUMN_ACCENT[col];

  return (
    <div className="flex-1 min-w-0 flex flex-col overflow-hidden border-r border-[var(--color-border-subtle)]">
      {/* Column header — 36px, includes top accent bar */}
      <div
        className="h-9 shrink-0 flex items-center gap-2 px-3 border-b border-[var(--color-border-subtle)]"
        style={{ borderTop: accentColor ? `2px solid ${accentColor}` : undefined }}
      >
        <span className="text-[11px] font-medium text-[var(--color-text-secondary)] uppercase tracking-[0.07em] font-sans">
          {COLUMN_LABELS[col]}
        </span>
        {/* Count badge — always visible (including 0) */}
        <span className="font-mono text-[11px] bg-[var(--color-surface-overlay)] text-[var(--color-text-secondary)] rounded-[3px] px-[5px] py-[1px]">
          {tasks.length}
        </span>
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-y-auto flex flex-col p-2 gap-1">
        {tasks.length === 0 ? (
          // Empty column state
          <div className="flex-1 flex flex-col items-center justify-center gap-1.5 p-4 opacity-45">
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              aria-hidden="true"
              className="text-[var(--color-text-disabled)]"
            >
              <rect
                x="3"
                y="3"
                width="14"
                height="14"
                rx="2"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeDasharray="3 2"
              />
            </svg>
            <span className="text-[11px] text-[var(--color-text-disabled)] text-center leading-[1.4]">
              No tasks yet
            </span>
          </div>
        ) : (
          tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              isSelected={selectedTaskId === task.id}
              onClick={onCardClick}
            />
          ))
        )}
      </div>
    </div>
  );
});

// ─── TaskBoard ────────────────────────────────────────────────────────────────

export const TaskBoard = memo(function TaskBoard({ tasks }: { tasks: Task[] }) {
  const tasksByStatus = useMemo(() => {
    const grouped: Record<string, Task[]> = {
      todo: [],
      in_progress: [],
      in_review: [],
      done: [],
    };
    for (const task of tasks) {
      if (!grouped[task.status]) grouped[task.status] = [];
      grouped[task.status].push(task);
    }
    return grouped;
  }, [tasks]);

  // Task detail popover state
  const [detailTask, setDetailTask] = useState<Task | null>(null);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);

  const handleCardClick = useCallback((task: Task, e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setDetailTask((prev) => (prev?.id === task.id ? null : task));
    setAnchorRect(rect);
  }, []);

  const handleCloseDetail = useCallback(() => {
    setDetailTask(null);
    setAnchorRect(null);
  }, []);

  return (
    <>
      <div className="flex h-full">
        {COLUMNS.map((col) => (
          <TaskColumn
            key={col}
            col={col}
            tasks={tasksByStatus[col] ?? []}
            onCardClick={handleCardClick}
            selectedTaskId={detailTask?.id ?? null}
          />
        ))}
      </div>

      {/* Task detail popover — rendered outside the board to avoid overflow clipping */}
      {detailTask && (
        <TaskDetailModal task={detailTask} onClose={handleCloseDetail} anchorRect={anchorRect} />
      )}
    </>
  );
});
