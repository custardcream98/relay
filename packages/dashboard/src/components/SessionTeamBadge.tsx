// packages/dashboard/src/components/SessionTeamBadge.tsx
// Emoji stack pill in AppHeader — shows current session team at a glance.
// Renders null when agents array is empty (zero cost for no-team sessions).

import { useEffect, useRef, useState } from "react";
import { cn } from "../lib/cn";
import type { AgentMeta } from "../types";

const MAX_VISIBLE = 5;

interface Props {
  agents: AgentMeta[];
}

export function SessionTeamBadge({ agents }: Props) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close popover on outside click or Escape
  useEffect(() => {
    if (!open) return;

    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("keydown", handleKey);
    document.addEventListener("mousedown", handleClick);
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.removeEventListener("mousedown", handleClick);
    };
  }, [open]);

  if (agents.length === 0) return null;

  const visible = agents.slice(0, MAX_VISIBLE);
  const overflow = agents.length - MAX_VISIBLE;

  return (
    <div ref={containerRef} className="relative">
      {/* Pill badge */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="true"
        aria-expanded={open}
        className={cn(
          "flex items-center px-2 py-[3px] rounded-full bg-[var(--color-surface-overlay)] cursor-pointer select-none transition-[border-color] duration-150",
          open
            ? "border border-[var(--color-border-default)]"
            : "border border-[var(--color-border-subtle)] hover:border-[var(--color-border-default)]"
        )}
      >
        {/* Overlapping emoji stack */}
        {visible.map((agent, i) => (
          <span
            key={agent.id}
            title={agent.name}
            className="text-[13px] inline-block relative"
            style={{ marginLeft: i === 0 ? 0 : -4, zIndex: MAX_VISIBLE - i }}
          >
            {agent.emoji}
          </span>
        ))}
        {overflow > 0 && (
          <span className="text-[10px] font-mono text-[var(--color-text-tertiary)] ml-1">
            +{overflow}
          </span>
        )}
      </button>

      {/* Popover */}
      {open && (
        <div
          role="tooltip"
          className="absolute top-[calc(100%+6px)] right-0 w-[240px] bg-[var(--color-surface-raised)] border border-[var(--color-border-default)] rounded-lg shadow-[var(--shadow-dropdown)] z-[100] overflow-hidden"
        >
          {/* Header */}
          <div className="px-3 pt-2 pb-1.5 border-b border-[var(--color-border-subtle)]">
            <span className="text-[10px] font-mono text-[var(--color-text-disabled)] uppercase tracking-[0.07em]">
              Session team
            </span>
          </div>

          {/* Agent rows */}
          <div className="py-1">
            {agents.map((agent) => (
              <div key={agent.id} className="flex items-center gap-2 h-9 px-3">
                <span className="text-[15px] shrink-0">{agent.emoji}</span>
                <span className="text-xs text-[var(--color-text-primary)] flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
                  {agent.name}
                </span>
                <span className="text-[10px] font-mono text-[var(--color-text-disabled)]">
                  {agent.id}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
