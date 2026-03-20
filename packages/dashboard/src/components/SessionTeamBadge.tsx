// packages/dashboard/src/components/SessionTeamBadge.tsx
// Emoji stack pill in AppHeader — shows current session team at a glance.
// Renders null when agents array is empty (zero cost for no-team sessions).
import { useCallback, useRef, useState } from "react";

import { usePopover } from "../hooks/usePopover";
import { cn } from "../lib/cn";
import type { AgentMeta } from "../types";

const MAX_VISIBLE = 5;

interface Props {
  agents: AgentMeta[];
}

export function SessionTeamBadge({ agents }: Props) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const handleClose = useCallback(() => setOpen(false), []);

  // Close popover on outside click or Escape
  usePopover(containerRef, handleClose, { enabled: open });

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
          "flex cursor-pointer items-center rounded-full bg-(--color-surface-overlay) px-2 py-[3px] transition-[border-color] duration-150 select-none",
          open
            ? "border border-(--color-border-default)"
            : "border border-(--color-border-subtle) hover:border-(--color-border-default)"
        )}
      >
        {/* Overlapping emoji stack */}
        {visible.map((agent, i) => (
          <span
            key={agent.id}
            title={agent.name}
            className="relative inline-block text-[13px]"
            style={{ marginLeft: i === 0 ? 0 : -4, zIndex: MAX_VISIBLE - i }}
          >
            {agent.emoji}
          </span>
        ))}
        {overflow > 0 && (
          <span className="ml-1 font-mono text-[10px] text-(--color-text-tertiary)">
            +{overflow}
          </span>
        )}
      </button>

      {/* Popover */}
      {open && (
        <div
          role="tooltip"
          className="absolute top-[calc(100%+6px)] right-0 z-100 w-[240px] overflow-hidden rounded-lg border border-(--color-border-default) bg-(--color-surface-raised) shadow-(--shadow-dropdown)"
        >
          {/* Header */}
          <div className="border-b border-(--color-border-subtle) px-3 pt-2 pb-1.5">
            <span className="font-mono text-[10px] tracking-[0.07em] text-(--color-text-disabled) uppercase">
              Session team
            </span>
          </div>

          {/* Agent rows */}
          <div className="py-1">
            {agents.map((agent) => (
              <div key={agent.id} className="flex h-9 items-center gap-2 px-3">
                <span className="shrink-0 text-[15px]">{agent.emoji}</span>
                <span className="flex-1 overflow-hidden text-xs text-ellipsis whitespace-nowrap text-(--color-text-primary)">
                  {agent.name}
                </span>
                <span className="font-mono text-[10px] text-(--color-text-disabled)">
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
