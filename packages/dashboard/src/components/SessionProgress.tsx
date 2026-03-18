// packages/dashboard/src/components/SessionProgress.tsx
// Session health summary widget — task completion, active agents, elapsed time.
// Placed in the AppHeader between the left brand and right controls.

import { useEffect, useMemo, useState } from "react";
import { useSession } from "../context/SessionContext";
import type { AgentId } from "../types";

export function SessionProgress() {
  const { tasks, agentStatuses, timeline } = useSession();

  // Derive task completion counts
  const { doneCount, totalCount, pct } = useMemo(() => {
    const total = tasks.length;
    const done = tasks.filter((t) => t.status === "done").length;
    const percent = total > 0 ? Math.round((done / total) * 100) : 0;
    return { doneCount: done, totalCount: total, pct: percent };
  }, [tasks]);

  // Count active (working) agents
  const activeAgentCount = useMemo(() => {
    return Object.values(agentStatuses).filter((s) => s === "working").length;
  }, [agentStatuses]);

  // Compute elapsed time since the first timeline entry
  const firstTimestamp = useMemo(() => {
    if (timeline.length === 0) return null;
    return timeline[0].timestamp;
  }, [timeline]);

  // Determine if session is finished:
  // All agents are done/waiting AND all tasks are done.
  // Requires at least one agent status to exist (empty = not yet started).
  const sessionFinished = useMemo(() => {
    const statuses = Object.values(agentStatuses);
    if (statuses.length === 0) return false;
    const allAgentsDone = statuses.every((s) => s === "done" || s === "waiting");
    const allTasksDone = tasks.length === 0 || tasks.every((t) => t.status === "done");
    return allAgentsDone && allTasksDone;
  }, [agentStatuses, tasks]);

  // Freeze the elapsed time when session finishes
  const [frozenNow, setFrozenNow] = useState<number | null>(null);
  useEffect(() => {
    if (sessionFinished) {
      // Capture the current time once when session finishes
      setFrozenNow((prev) => prev ?? Date.now());
    } else {
      // Session resumed (re-spawn) — clear frozen time
      setFrozenNow(null);
    }
  }, [sessionFinished]);

  // Auto-update elapsed time every second (only when session is active)
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!firstTimestamp || sessionFinished) return;
    // Ensure `now` is fresh when interval starts (e.g. after resume)
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [firstTimestamp, sessionFinished]);

  // Use frozen time when session is finished, otherwise use live `now`
  const displayNow = frozenNow ?? now;

  const elapsedLabel = useMemo(() => {
    if (!firstTimestamp) return null;
    const diffMs = displayNow - firstTimestamp;
    if (diffMs < 0) return "0s";
    const totalSec = Math.floor(diffMs / 1000);
    if (totalSec < 60) return `${totalSec}s`;
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    if (min < 60) return sec > 0 ? `${min}m ${sec}s` : `${min}m`;
    const hr = Math.floor(min / 60);
    const remMin = min % 60;
    return remMin > 0 ? `${hr}h ${remMin}m` : `${hr}h`;
  }, [firstTimestamp, displayNow]);

  // Hide when no session data exists
  const hasData =
    totalCount > 0 || Object.keys(agentStatuses as Record<AgentId, string>).length > 0;
  if (!hasData) return null;

  return (
    <div
      className="flex items-center gap-3 px-3 py-[3px] rounded-full font-mono text-[11px] shrink-0"
      style={{
        background: "var(--color-surface-overlay)",
        border: "1px solid var(--color-border-subtle)",
      }}
    >
      {/* Task completion */}
      {totalCount > 0 && (
        <span className="flex items-center gap-1.5 text-(--color-text-secondary)">
          <span
            className="font-semibold tabular-nums"
            style={{
              color: pct === 100 ? "var(--color-status-done-text)" : "var(--color-text-primary)",
            }}
          >
            {doneCount}/{totalCount}
          </span>
          <span className="text-(--color-text-disabled)">tasks</span>
          <span
            className="text-[10px] font-medium tabular-nums px-[5px] py-px rounded-[3px]"
            style={{
              color: pct === 100 ? "var(--color-status-done-text)" : "var(--color-text-tertiary)",
              background:
                pct === 100 ? "var(--color-status-done-bg)" : "var(--color-surface-raised)",
            }}
          >
            {pct}%
          </span>
        </span>
      )}

      {/* Separator */}
      {totalCount > 0 && activeAgentCount > 0 && (
        <span className="w-px h-3 bg-(--color-border-subtle)" />
      )}

      {/* Active agents */}
      {activeAgentCount > 0 && (
        <span className="flex items-center gap-1 text-(--color-text-secondary)">
          <span
            className="w-[6px] h-[6px] rounded-full inline-block shrink-0"
            style={{
              background: "var(--color-status-working)",
              boxShadow: "0 0 0 2px rgba(52, 211, 153, 0.2)",
            }}
          />
          <span className="font-semibold tabular-nums">{activeAgentCount}</span>
          <span className="text-(--color-text-disabled)">active</span>
        </span>
      )}

      {/* Separator */}
      {elapsedLabel && (totalCount > 0 || activeAgentCount > 0) && (
        <span className="w-px h-3 bg-(--color-border-subtle)" />
      )}

      {/* Elapsed time */}
      {elapsedLabel && (
        <span className="text-(--color-text-disabled) tabular-nums">{elapsedLabel}</span>
      )}
    </div>
  );
}
