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
          "flex items-center px-2 py-[3px] rounded-full bg-(--color-surface-overlay) cursor-pointer select-none transition-[border-color] duration-150",
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
            className="text-[13px] inline-block relative"
            style={{ marginLeft: i === 0 ? 0 : -4, zIndex: MAX_VISIBLE - i }}
          >
            {agent.emoji}
          </span>
        ))}
        {overflow > 0 && (
          <span className="text-[10px] font-mono text-(--color-text-tertiary) ml-1">
            +{overflow}
          </span>
        )}
      </button>

      {/* Popover */}
      {open && (
        <div
          role="tooltip"
          className="absolute top-[calc(100%+6px)] right-0 w-[240px] bg-(--color-surface-raised) border border-(--color-border-default) rounded-lg shadow-(--shadow-dropdown) z-100 overflow-hidden"
        >
          {/* Header */}
          <div className="px-3 pt-2 pb-1.5 border-b border-(--color-border-subtle)">
            <span className="text-[10px] font-mono text-(--color-text-disabled) uppercase tracking-[0.07em]">
              Session team
            </span>
          </div>

          {/* Agent rows */}
          <div className="py-1">
            {agents.map((agent) => (
              <div key={agent.id} className="flex items-center gap-2 h-9 px-3">
                <span className="text-[15px] shrink-0">{agent.emoji}</span>
                <span className="text-xs text-(--color-text-primary) flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
                  {agent.name}
                </span>
                <span className="text-[10px] font-mono text-(--color-text-disabled)">
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
