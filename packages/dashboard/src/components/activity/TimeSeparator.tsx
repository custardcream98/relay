// packages/dashboard/src/components/activity/TimeSeparator.tsx
// Compact horizontal divider inserted when >60s gap between consecutive timeline entries.
import { memo } from "react";

/** Format timestamp as HH:MM (absolute time — more useful in a timeline than "3 mins ago") */
function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export const TimeSeparator = memo(function TimeSeparator({ timestamp }: { timestamp: number }) {
  return (
    <div className="flex items-center gap-2 py-1 text-xs text-(--color-text-tertiary)">
      <div className="flex-1 border-t border-(--color-border-secondary)" />
      <span className="font-mono text-[10px]">{formatTime(timestamp)}</span>
      <div className="flex-1 border-t border-(--color-border-secondary)" />
    </div>
  );
});
