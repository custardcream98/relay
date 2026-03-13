// packages/dashboard/src/components/TaskBoard.tsx
import { useMemo } from "react";
import { AGENT_ACCENT_HEX } from "../constants/agents";

interface Task {
  id: string;
  title: string;
  assignee: string | null;
  status: string;
  priority: string;
}

const COLUMNS = ["todo", "in_progress", "in_review", "done"] as const;
const COLUMN_LABELS: Record<string, string> = {
  todo: "Todo",
  in_progress: "In Progress",
  in_review: "In Review",
  done: "Done",
};

// 컬럼별 상단 액센트 바 색상 (todo 제외)
const COLUMN_ACCENT: Record<string, string | undefined> = {
  todo: undefined,
  in_progress: "rgba(96,165,250,0.5)",
  in_review: "rgba(251,191,36,0.5)",
  done: "rgba(52,211,153,0.5)",
};

// 우선순위별 왼쪽 액센트 바 색상
const PRIORITY_BAR_COLOR: Record<string, string> = {
  critical: "#ef4444",
  high: "#f97316",
  medium: "#eab308",
  low: "transparent",
};

export function TaskBoard({ tasks }: { tasks: Task[] }) {
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
            {/* 컬럼 헤더 — 36px, 상단 액센트 바 포함 */}
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
                // in_progress/in_review/done: 상단 2px 액센트 바
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
              {/* 카운트 배지 — 항상 표시 (0개도 보임) */}
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

            {/* 태스크 목록 */}
            <div className="flex-1 overflow-y-auto flex flex-col" style={{ padding: 8, gap: 4 }}>
              {colTasks.map((task) => {
                const isDone = col === "done";
                const priorityBarColor = PRIORITY_BAR_COLOR[task.priority] ?? "transparent";
                const accentHex = task.assignee
                  ? (AGENT_ACCENT_HEX[task.assignee] ?? "#9898a8")
                  : null;
                const showPriorityLabel = task.priority === "critical" || task.priority === "high";

                return (
                  // biome-ignore lint/a11y/noStaticElementInteractions: hover 시 카드 스타일 변경을 위한 마우스 핸들러로, 상호작용 의미 없음
                  <div
                    key={task.id}
                    style={{
                      position: "relative",
                      overflow: "hidden",
                      // 왼쪽 여백: 우선순위 바 공간 확보
                      padding: "8px 10px 8px 14px",
                      background: "var(--color-surface-raised)",
                      border: "1px solid var(--color-border-subtle)",
                      borderRadius: 6,
                      boxShadow: "var(--shadow-card)",
                      // done 카드: opacity 낮춤
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
                    {/* 왼쪽 우선순위 액센트 바 */}
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

                    {/* 태스크 제목 */}
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

                    {/* 메타 행 — 담당자 칩 + 우선순위 레이블 */}
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
                        {/* 담당자 칩 */}
                        {task.assignee && accentHex && (
                          <span
                            className="font-mono"
                            style={{
                              fontSize: 10,
                              fontWeight: 500,
                              padding: "1px 5px",
                              borderRadius: 3,
                              // accent 색상 텍스트 + accent/10 배경
                              color: accentHex,
                              background: `${accentHex}1a`,
                            }}
                          >
                            {task.assignee}
                          </span>
                        )}
                        {/* critical/high 우선순위 레이블 */}
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
}
