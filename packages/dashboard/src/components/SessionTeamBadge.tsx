// packages/dashboard/src/components/SessionTeamBadge.tsx
// Emoji stack pill in AppHeader — shows current session team at a glance.
// Renders null when agents array is empty (zero cost for no-team sessions).

import { useEffect, useRef, useState } from "react";
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
    <div ref={containerRef} style={{ position: "relative" }}>
      {/* Pill badge */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="true"
        aria-expanded={open}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 0,
          padding: "3px 8px",
          borderRadius: 9999,
          background: "var(--color-surface-overlay)",
          border: `1px solid ${open ? "var(--color-border-default)" : "var(--color-border-subtle)"}`,
          cursor: "pointer",
          userSelect: "none",
          transition: "border-color 0.15s",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--color-border-default)";
        }}
        onMouseLeave={(e) => {
          if (!open) {
            (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--color-border-subtle)";
          }
        }}
      >
        {/* Overlapping emoji stack */}
        {visible.map((agent, i) => (
          <span
            key={agent.id}
            title={agent.name}
            style={{
              fontSize: 13,
              display: "inline-block",
              marginLeft: i === 0 ? 0 : -4,
              zIndex: MAX_VISIBLE - i,
              position: "relative",
            }}
          >
            {agent.emoji}
          </span>
        ))}
        {overflow > 0 && (
          <span
            style={{
              fontSize: 10,
              fontFamily: "var(--font-mono)",
              color: "var(--color-text-tertiary)",
              marginLeft: 4,
            }}
          >
            +{overflow}
          </span>
        )}
      </button>

      {/* Popover */}
      {open && (
        <div
          role="tooltip"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            right: 0,
            width: 240,
            background: "var(--color-surface-raised)",
            border: "1px solid var(--color-border-default)",
            borderRadius: 8,
            boxShadow: "var(--shadow-dropdown)",
            zIndex: 100,
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: "8px 12px 6px",
              borderBottom: "1px solid var(--color-border-subtle)",
            }}
          >
            <span
              style={{
                fontSize: 10,
                fontFamily: "var(--font-mono)",
                color: "var(--color-text-disabled)",
                textTransform: "uppercase",
                letterSpacing: "0.07em",
              }}
            >
              Session team
            </span>
          </div>

          {/* Agent rows */}
          <div style={{ padding: "4px 0" }}>
            {agents.map((agent) => (
              <div
                key={agent.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  height: 36,
                  padding: "0 12px",
                }}
              >
                <span style={{ fontSize: 15, flexShrink: 0 }}>{agent.emoji}</span>
                <span
                  style={{
                    fontSize: 12,
                    color: "var(--color-text-primary)",
                    flex: 1,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {agent.name}
                </span>
                <span
                  style={{
                    fontSize: 10,
                    fontFamily: "var(--font-mono)",
                    color: "var(--color-text-disabled)",
                  }}
                >
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
