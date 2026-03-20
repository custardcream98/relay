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
      <div className="shrink-0 border-b border-(--color-border-subtle) px-3 py-2">
        <div className="h-[6px] rounded-full bg-(--color-surface-overlay)" />
        <p className="mt-1.5 text-center font-mono text-[10px] text-(--color-text-disabled)">
          No tasks
        </p>
      </div>
    );
  }

  return (
    <div className="shrink-0 border-b border-(--color-border-subtle) px-3 py-2">
      {/* Stacked bar */}
      <div className="flex h-[6px] overflow-hidden rounded-full bg-(--color-surface-overlay)">
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
      <div className="mt-1.5 flex flex-wrap items-center justify-center gap-1">
        {STATUS_ORDER.map((status, idx) => {
          const count = counts[status] ?? 0;
          return (
            <span key={status} className="flex items-center gap-0.5">
              {idx > 0 && <span className="mx-0.5 text-[9px] text-(--color-text-disabled)">·</span>}
              <span
                className="inline-block h-[6px] w-[6px] shrink-0 rounded-full"
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
