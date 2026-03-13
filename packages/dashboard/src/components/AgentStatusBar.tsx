// packages/dashboard/src/components/AgentStatusBar.tsx
import { useEffect, useState } from "react";
import { AGENT_ACCENT_HEX } from "../constants/agents";
import type { AgentId } from "../types";

interface AgentMeta {
  id: AgentId;
  name: string;
  emoji: string;
}

interface Props {
  statuses: Partial<Record<AgentId, "idle" | "working" | "waiting">>;
  selected: AgentId | null;
  onSelect: (id: AgentId) => void;
}

export function AgentStatusBar({ statuses, selected, onSelect }: Props) {
  const [agents, setAgents] = useState<AgentMeta[]>([]);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("/api/agents")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(setAgents)
      .catch(() => setError(true));
  }, []);

  if (error) {
    return (
      <div
        className="flex items-center px-4 flex-shrink-0"
        style={{
          height: 36,
          background: "var(--color-surface-base)",
          borderBottom: "1px solid var(--color-border-subtle)",
        }}
      >
        <span style={{ fontSize: 11, color: "#ef4444" }}>Failed to load agents</span>
      </div>
    );
  }

  return (
    // 높이 36px, surface-base 배경, border-bottom border-subtle
    <div
      className="flex items-center gap-1 px-3 overflow-x-auto flex-shrink-0"
      style={{
        height: 36,
        background: "var(--color-surface-base)",
        borderBottom: "1px solid var(--color-border-subtle)",
      }}
    >
      {agents.map(({ id, name, emoji }) => {
        const status = statuses[id] ?? "idle";
        const isWorking = status === "working";
        const isWaiting = status === "waiting";
        const isSelected = selected === id;
        const accentColor = AGENT_ACCENT_HEX[id] ?? "#9898a8";

        // 텍스트 색상: idle=text-tertiary, working=accent, waiting=text-secondary
        const textColor = isWorking
          ? accentColor
          : isWaiting
            ? "var(--color-text-secondary)"
            : isSelected
              ? "var(--color-text-secondary)"
              : "var(--color-text-tertiary)";

        // 상태 도트 색상
        const dotColor = isWorking
          ? "var(--color-status-working)"
          : isWaiting
            ? "var(--color-status-waiting)"
            : "var(--color-status-idle)";

        return (
          <button
            type="button"
            key={id}
            aria-pressed={isSelected}
            onClick={() => onSelect(id)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "4px 10px",
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 500,
              // 선택된 칩: surface-overlay 배경 + border-default 테두리
              background: isSelected ? "var(--color-surface-overlay)" : "transparent",
              border: isSelected
                ? "1px solid var(--color-border-default)"
                : "1px solid transparent",
              color: textColor,
              cursor: "pointer",
              transition: "background 100ms, border-color 100ms",
              flexShrink: 0,
            }}
            onMouseEnter={(e) => {
              if (!isSelected) {
                (e.currentTarget as HTMLButtonElement).style.background =
                  "var(--color-surface-raised)";
              }
            }}
            onMouseLeave={(e) => {
              if (!isSelected) {
                (e.currentTarget as HTMLButtonElement).style.background = "transparent";
              }
            }}
          >
            {/* 에이전트 이모지 — idle 시 opacity 50%, working/waiting/선택 시 100% */}
            <span
              style={{
                fontSize: 14,
                lineHeight: 1,
                opacity: isWorking || isWaiting || isSelected ? 1 : 0.5,
              }}
            >
              {emoji}
            </span>
            <span>{name}</span>
            {/* 상태 도트 — 5px 원형 */}
            <span
              style={{
                width: 5,
                height: 5,
                borderRadius: "50%",
                flexShrink: 0,
                display: "inline-block",
                background: dotColor,
                // working 상태: glow 효과 + scale-pulse 애니메이션
                boxShadow: isWorking ? "0 0 0 2px rgba(52,211,153,0.2)" : undefined,
                animation: isWorking ? "scale-pulse 1.2s ease-in-out infinite" : undefined,
              }}
            />
          </button>
        );
      })}
    </div>
  );
}
