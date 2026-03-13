// packages/dashboard/src/components/AppHeader.tsx
// App top header — docs nav 스타일과 통일

import { memo } from "react";
import type { AgentId } from "../types";

interface Props {
  connected: boolean;
  agentCount: number;
  selectedAgent: AgentId | null;
  onClearFocus: () => void;
}

export const AppHeader = memo(function AppHeader({
  connected,
  agentCount,
  selectedAgent,
  onClearFocus,
}: Props) {
  return (
    <div
      className="flex items-center justify-between px-5 shrink-0"
      style={{
        height: 52,
        background: "color-mix(in srgb, var(--color-surface-root) 88%, transparent)",
        borderBottom: "1px solid var(--color-border-default)",
        backdropFilter: "blur(12px) saturate(1.2)",
        WebkitBackdropFilter: "blur(12px) saturate(1.2)",
        position: "sticky",
        top: 0,
        zIndex: 50,
      }}
    >
      {/* 왼쪽: relay_ 워드마크 */}
      <div className="flex items-center gap-3">
        <span
          style={{
            fontSize: 15,
            fontWeight: 500,
            letterSpacing: "-0.04em",
            fontFamily: "var(--font-mono)",
            color: "var(--color-text-primary)",
            display: "flex",
            alignItems: "baseline",
          }}
        >
          relay
          <span
            style={{
              color: "var(--color-accent)",
              animation: "blink 1.1s step-end infinite",
              fontWeight: 400,
            }}
          >
            _
          </span>
        </span>
        <span
          style={{
            fontSize: 10,
            fontFamily: "var(--font-mono)",
            background: "var(--color-accent-glow)",
            color: "var(--color-accent)",
            border: "1px solid var(--color-accent)",
            padding: "2px 8px",
            borderRadius: 9999,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            fontWeight: 500,
            opacity: 0.9,
          }}
        >
          dashboard
        </span>
      </div>

      {/* 중앙: Focus Mode 배지 */}
      {selectedAgent && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "4px 12px",
            borderRadius: 9999,
            background: "var(--color-accent-glow)",
            border: "1px solid var(--color-accent)",
          }}
        >
          <span
            style={{
              fontSize: 11,
              fontWeight: 500,
              fontFamily: "var(--font-mono)",
              color: "var(--color-accent)",
              letterSpacing: "0.02em",
            }}
          >
            focus: {selectedAgent}
          </span>
          <button
            type="button"
            onClick={onClearFocus}
            style={{
              fontSize: 14,
              color: "var(--color-text-tertiary)",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "0 2px",
              lineHeight: 1,
            }}
            aria-label="Exit Focus Mode"
          >
            ×
          </button>
        </div>
      )}

      {/* 오른쪽: 에이전트 수 + 연결 상태 */}
      <div className="flex items-center gap-4">
        {agentCount > 0 && (
          <span
            style={{
              fontSize: 11,
              fontFamily: "var(--font-mono)",
              color: "var(--color-text-tertiary)",
              letterSpacing: "0.04em",
            }}
          >
            {agentCount} agents
          </span>
        )}

        {/* biome-ignore lint/a11y/useSemanticElements: div layout required */}
        <div
          className="flex items-center gap-1.5"
          role="status"
          aria-label={connected ? "Connected" : "Disconnected"}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              display: "inline-block",
              background: connected
                ? "var(--color-connection-live)"
                : "var(--color-connection-dead)",
              boxShadow: connected ? "0 0 0 2px rgba(52,211,153,0.25)" : undefined,
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontSize: 11,
              color: "var(--color-text-disabled)",
              fontFamily: "var(--font-mono)",
              letterSpacing: "0.04em",
            }}
          >
            {connected ? "live" : "offline"}
          </span>
        </div>
      </div>
    </div>
  );
});
