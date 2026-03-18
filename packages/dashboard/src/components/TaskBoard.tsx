// packages/dashboard/src/components/TaskBoard.tsx
import { memo, useCallback, useMemo, useState } from "react";
import { getAgentAccent } from "../constants/agents";
import { COLUMN_ACCENT, PRIORITY_BAR_COLOR, STATUS_ORDER } from "../constants/status";
import { cn } from "../lib/cn";
import type { Task } from "../types";
import { TaskDetailModal } from "./TaskDetailModal";
import { TaskProgressBar } from "./TaskProgressBar";

const COLUMNS = STATUS_ORDER;
const COLUMN_LABELS: Record<string, string> = {
  todo: "Todo",
  in_progress: "In Progress",
  in_review: "In Review",
  done: "Done",
};

// ─── TaskCard ────────────────────────────────────────────────────────────────

interface TaskCardProps {
  task: Task;
  isSelected: boolean;
  onClick: (task: Task, e: React.MouseEvent<HTMLButtonElement>) => void;
  blockedByCount: number;
  blocksCount: number;
}

const TaskCard = memo(function TaskCard({
  task,
  isSelected,
  onClick,
  blockedByCount,
  blocksCount,
}: TaskCardProps) {
  const isBlocked = blockedByCount > 0;
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
        isBlocked && !isDone && "opacity-60 border-dashed",
        isSelected
          ? "bg-(--color-surface-overlay) border border-(--color-border-default) shadow-(--shadow-card-hover)"
          : "bg-(--color-surface-raised) border border-(--color-border-subtle) shadow-(--shadow-card)"
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
          isDone ? "text-(--color-text-tertiary) line-through" : "text-(--color-text-primary)"
        )}
      >
        {task.title}
      </span>

      {/* Description preview — 2-line clamp */}
      {task.description && (
        <p
          className="text-[11px] leading-normal text-(--color-text-tertiary) mt-1 overflow-hidden wrap-break-word"
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
              className="font-mono text-[11px] font-medium px-1.5 py-px rounded-[3px]"
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
            <span className="font-mono text-[11px] text-(--color-text-secondary)">
              {task.priority}
            </span>
          )}
        </div>
      )}

      {/* Dependency indicators */}
      {(blockedByCount > 0 || blocksCount > 0) && (
        <div className="mt-1.5 flex flex-col gap-0.5">
          {blockedByCount > 0 && (
            <span className="text-[10px] font-mono font-medium px-1.5 py-px rounded-[3px] text-(--color-end-waiting) bg-(--color-status-in-review-bg)">
              Blocked by {blockedByCount}
            </span>
          )}
          {blocksCount > 0 && (
            <span className="text-[10px] font-mono text-(--color-text-disabled)">
              Blocks {blocksCount} {blocksCount === 1 ? "task" : "tasks"}
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
  blockedByMap: Record<string, number>;
  blocksMap: Record<string, number>;
}

const TaskColumn = memo(function TaskColumn({
  col,
  tasks,
  onCardClick,
  selectedTaskId,
  blockedByMap,
  blocksMap,
}: TaskColumnProps) {
  const accentColor = COLUMN_ACCENT[col];

  return (
    <div className="flex-1 min-w-0 flex flex-col overflow-hidden border-r border-(--color-border-subtle)">
      {/* Column header — 36px, includes top accent bar */}
      <div
        className="h-9 shrink-0 flex items-center gap-2 px-3 border-b border-(--color-border-subtle)"
        style={{ borderTop: accentColor ? `2px solid ${accentColor}` : undefined }}
      >
        <span className="text-[11px] font-medium text-(--color-text-secondary) uppercase tracking-[0.07em] font-sans">
          {COLUMN_LABELS[col]}
        </span>
        {/* Count badge — always visible (including 0) */}
        <span className="font-mono text-[11px] bg-(--color-surface-overlay) text-(--color-text-secondary) rounded-[3px] px-[5px] py-px">
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
              className="text-(--color-text-disabled)"
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
            <span className="text-[11px] text-(--color-text-disabled) text-center leading-[1.4]">
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
              blockedByCount={blockedByMap[task.id] ?? 0}
              blocksCount={blocksMap[task.id] ?? 0}
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

  // Dependency lookup maps — memoized for performance
  const { blockedByMap, blocksMap } = useMemo(() => {
    const taskStatusById: Record<string, string> = {};
    for (const t of tasks) {
      taskStatusById[t.id] = t.status;
    }

    const blocked: Record<string, number> = {};
    const blocks: Record<string, number> = {};

    for (const t of tasks) {
      if (t.depends_on && t.depends_on.length > 0) {
        // Count how many of this task's dependencies are NOT done
        const unresolved = t.depends_on.filter(
          (depId) => taskStatusById[depId] !== undefined && taskStatusById[depId] !== "done"
        ).length;
        if (unresolved > 0) blocked[t.id] = unresolved;

        // Reverse: each dependency task blocks this task
        for (const depId of t.depends_on) {
          if (taskStatusById[depId] !== undefined && taskStatusById[depId] !== "done") {
            blocks[depId] = (blocks[depId] ?? 0) + 1;
          }
        }
      }
    }

    return { blockedByMap: blocked, blocksMap: blocks };
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
    <div className="flex flex-col h-full">
      <TaskProgressBar tasks={tasks} />
      <div className="flex flex-1 min-h-0">
        {COLUMNS.map((col) => (
          <TaskColumn
            key={col}
            col={col}
            tasks={tasksByStatus[col] ?? []}
            onCardClick={handleCardClick}
            selectedTaskId={detailTask?.id ?? null}
            blockedByMap={blockedByMap}
            blocksMap={blocksMap}
          />
        ))}
      </div>

      {/* Task detail popover — rendered outside the board to avoid overflow clipping */}
      {detailTask && (
        <TaskDetailModal
          task={detailTask}
          onClose={handleCloseDetail}
          anchorRect={anchorRect}
          allTasks={tasks}
          onSelectTask={(t) => {
            setDetailTask(t);
            setAnchorRect(null);
          }}
        />
      )}
    </div>
  );
});
