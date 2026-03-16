// packages/dashboard/src/components/TaskBoard.tsx
import { memo, useCallback, useMemo, useState } from "react";
import { getAgentAccent } from "../constants/agents";
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
  critical: "#ef4444",
  high: "#f97316",
  medium: "#eab308",
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
      className="task-card"
      aria-label={`Task: ${task.title}. Click to view details.`}
      aria-expanded={isSelected}
      style={{
        position: "relative",
        overflow: "hidden",
        // left padding: space for priority bar
        padding: "8px 10px 8px 14px",
        background: isSelected ? "var(--color-surface-overlay)" : "var(--color-surface-raised)",
        border: isSelected
          ? "1px solid var(--color-border-default)"
          : "1px solid var(--color-border-subtle)",
        borderRadius: 6,
        boxShadow: isSelected ? "var(--shadow-card-hover)" : "var(--shadow-card)",
        // done cards: reduced opacity
        opacity: isDone ? 0.45 : 1,
        transition: "background 100ms, border-color 100ms, box-shadow 100ms",
        cursor: "pointer",
        // prevent card from being flattened in flex container
        flexShrink: 0,
        // reset button defaults
        width: "100%",
        textAlign: "left",
        font: "inherit",
        color: "inherit",
      }}
      onClick={(e) => onClick(task, e)}
    >
      {/* Left priority accent bar */}
      <span
        style={{
          position: "absolute",
          left: 0,
          top: 4,
          bottom: 4,
          width: 2,
          borderRadius: 1,
          background: priorityBarColor,
        }}
      />

      {/* Task title */}
      <span
        style={{
          fontSize: 13,
          fontWeight: 400,
          lineHeight: 1.45,
          color: isDone ? "var(--color-text-tertiary)" : "var(--color-text-primary)",
          textDecoration: isDone ? "line-through" : undefined,
          display: "block",
        }}
      >
        {task.title}
      </span>

      {/* Description preview — 2-line clamp */}
      {task.description && (
        <p
          style={{
            fontSize: 11,
            lineHeight: 1.5,
            color: "var(--color-text-tertiary)",
            margin: "4px 0 0",
            overflow: "hidden",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            wordBreak: "break-word",
          }}
        >
          {task.description}
        </p>
      )}

      {/* Meta row — assignee chip + priority label */}
      {(task.assignee || showPriorityLabel) && (
        <div
          style={{
            marginTop: 6,
            display: "flex",
            flexDirection: "row",
            gap: 6,
            alignItems: "center",
          }}
        >
          {/* Assignee chip */}
          {task.assignee && accentHex && (
            <span
              className="font-mono"
              style={{
                fontSize: 11,
                fontWeight: 500,
                padding: "1px 6px",
                borderRadius: 3,
                color: accentHex,
                background: `${accentHex}1a`,
              }}
            >
              {task.assignee}
            </span>
          )}
          {/* critical/high priority label */}
          {showPriorityLabel && (
            <span
              className="font-mono"
              style={{
                fontSize: 11,
                color: "var(--color-text-secondary)",
              }}
            >
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
    <div
      className="flex-1 min-w-0 flex flex-col overflow-hidden"
      style={{ borderRight: "1px solid var(--color-border-subtle)" }}
    >
      {/* Column header — 36px, includes top accent bar */}
      <div
        style={{
          height: 36,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          gap: 8,
          paddingLeft: 12,
          paddingRight: 12,
          borderBottom: "1px solid var(--color-border-subtle)",
          // in_progress/in_review/done: top 2px accent bar
          borderTop: accentColor ? `2px solid ${accentColor}` : undefined,
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 500,
            color: "var(--color-text-secondary)",
            textTransform: "uppercase",
            letterSpacing: "0.07em",
            fontFamily: "var(--font-sans)",
          }}
        >
          {COLUMN_LABELS[col]}
        </span>
        {/* Count badge — always visible (including 0) */}
        <span
          className="font-mono"
          style={{
            fontSize: 11,
            background: "var(--color-surface-overlay)",
            color: "var(--color-text-secondary)",
            borderRadius: 3,
            padding: "1px 5px",
          }}
        >
          {tasks.length}
        </span>
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-y-auto flex flex-col" style={{ padding: 8, gap: 4 }}>
        {tasks.length === 0 ? (
          // Empty column state
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              padding: "16px 8px",
              opacity: 0.45,
            }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              aria-hidden="true"
              style={{ color: "var(--color-text-disabled)" }}
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
            <span
              style={{
                fontSize: 11,
                color: "var(--color-text-disabled)",
                textAlign: "center",
                lineHeight: 1.4,
              }}
            >
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

  // Fix: use HTMLButtonElement (cards are <button> elements)
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
      <div className="flex h-full" style={{ borderRight: "none" }}>
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
