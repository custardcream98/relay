// packages/dashboard/src/components/TaskProgressBar.tsx
// Stacked horizontal progress bar showing task status proportions.
// Rendered at the top of the TaskBoard panel.

import { memo, useMemo } from "react";
import { STATUS_COLORS, STATUS_LABELS, STATUS_ORDER } from "../constants/status";
import type { Task } from "../types";

interface Props {
  tasks: Task[];
}

export const TaskProgressBar = memo(function TaskProgressBar({ tasks }: Props) {
  const { counts, total } = useMemo(() => {
    const c: Record<string, number> = { todo: 0, in_progress: 0, in_review: 0, done: 0 };
    for (const t of tasks) {
      c[t.status] = (c[t.status] ?? 0) + 1;
    }
    return { counts: c, total: tasks.length };
  }, [tasks]);

  if (total === 0) {
    return (
      <div className="px-3 py-2 border-b border-(--color-border-subtle) shrink-0">
        <div className="h-[6px] rounded-full bg-(--color-surface-overlay)" />
        <p className="text-[10px] font-mono text-(--color-text-disabled) mt-1.5 text-center">
          No tasks
        </p>
      </div>
    );
  }

  return (
    <div className="px-3 py-2 border-b border-(--color-border-subtle) shrink-0">
      {/* Stacked bar */}
      <div className="flex h-[6px] rounded-full overflow-hidden bg-(--color-surface-overlay)">
        {STATUS_ORDER.map((status) => {
          const count = counts[status] ?? 0;
          if (count === 0) return null;
          const widthPct = (count / total) * 100;
          return (
            <div
              key={status}
              className="h-full"
              style={{
                width: `${widthPct}%`,
                background: STATUS_COLORS[status],
                transition: "width 300ms ease",
              }}
            />
          );
        })}
      </div>

      {/* Count labels */}
      <div className="flex items-center gap-1 mt-1.5 justify-center flex-wrap">
        {STATUS_ORDER.map((status, idx) => {
          const count = counts[status] ?? 0;
          return (
            <span key={status} className="flex items-center gap-0.5">
              {idx > 0 && <span className="text-(--color-text-disabled) text-[9px] mx-0.5">·</span>}
              <span
                className="w-[6px] h-[6px] rounded-full inline-block shrink-0"
                style={{ background: STATUS_COLORS[status] }}
              />
              <span className="font-mono text-[10px] text-(--color-text-tertiary)">
                {count} {STATUS_LABELS[status]}
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
});
