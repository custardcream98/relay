// packages/dashboard/src/components/TaskBoard.tsx
import { memo, useMemo } from "react";
import { AGENT_ACCENT_HEX, DEFAULT_AGENT_ACCENT } from "../constants/agents";
import type { Task } from "../types";

const COLUMNS = ["todo", "in_progress", "in_review", "done"] as const;
const COLUMN_LABELS: Record<string, string> = {
  todo: "Todo",
  in_progress: "In Progress",
  in_review: "In Review",
  done: "Done",
};

// Top accent bar color per column (excluding todo)
const COLUMN_ACCENT: Record<string, string | undefined> = {
  todo: undefined,
  in_progress: "rgba(96,165,250,0.5)",
  in_review: "rgba(251,191,36,0.5)",
  done: "rgba(52,211,153,0.5)",
};

// Left accent bar color per priority
const PRIORITY_BAR_COLOR: Record<string, string> = {
  critical: "#ef4444",
  high: "#f97316",
  medium: "#eab308",
  low: "transparent",
};

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

  return (
    <div className="flex h-full" style={{ borderRight: "none" }}>
      {COLUMNS.map((col) => {
        const colTasks = tasksByStatus[col] ?? [];
        const accentColor = COLUMN_ACCENT[col];

        return (
          <div
            key={col}
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
                  fontSize: 10,
                  fontWeight: 500,
                  color: "var(--color-text-disabled)",
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
                  fontSize: 10,
                  background: "var(--color-surface-overlay)",
                  color: "var(--color-text-disabled)",
                  borderRadius: 3,
                  padding: "1px 5px",
                }}
              >
                {colTasks.length}
              </span>
            </div>

            {/* Task list */}
            <div className="flex-1 overflow-y-auto flex flex-col" style={{ padding: 8, gap: 4 }}>
              {colTasks.map((task) => {
                const isDone = col === "done";
                const priorityBarColor = PRIORITY_BAR_COLOR[task.priority] ?? "transparent";
                const accentHex = task.assignee
                  ? (AGENT_ACCENT_HEX[task.assignee] ?? DEFAULT_AGENT_ACCENT)
                  : null;
                const showPriorityLabel = task.priority === "critical" || task.priority === "high";

                return (
                  // biome-ignore lint/a11y/noStaticElementInteractions: mouse handler for hover card styling only, no semantic interaction
                  <div
                    key={task.id}
                    style={{
                      position: "relative",
                      overflow: "hidden",
                      // left padding: space for priority bar
                      padding: "8px 10px 8px 14px",
                      background: "var(--color-surface-raised)",
                      border: "1px solid var(--color-border-subtle)",
                      borderRadius: 6,
                      boxShadow: "var(--shadow-card)",
                      // done cards: reduced opacity
                      opacity: isDone ? 0.45 : 1,
                      transition: "background 100ms, border-color 100ms, box-shadow 100ms",
                      cursor: "default",
                    }}
                    onMouseEnter={(e) => {
                      const el = e.currentTarget as HTMLDivElement;
                      el.style.background = "var(--color-surface-overlay)";
                      el.style.borderColor = "var(--color-border-default)";
                      el.style.boxShadow = "var(--shadow-card-hover)";
                    }}
                    onMouseLeave={(e) => {
                      const el = e.currentTarget as HTMLDivElement;
                      el.style.background = "var(--color-surface-raised)";
                      el.style.borderColor = "var(--color-border-subtle)";
                      el.style.boxShadow = "var(--shadow-card)";
                    }}
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
                        fontSize: 12,
                        fontWeight: 450,
                        lineHeight: 1.4,
                        color: isDone ? "var(--color-text-tertiary)" : "var(--color-text-primary)",
                        textDecoration: isDone ? "line-through" : undefined,
                        display: "block",
                      }}
                    >
                      {task.title}
                    </span>

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
                              fontSize: 10,
                              fontWeight: 500,
                              padding: "1px 5px",
                              borderRadius: 3,
                              // accent color text + accent/10 background
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
                              fontSize: 10,
                              color: "var(--color-text-tertiary)",
                            }}
                          >
                            {task.priority}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
});
