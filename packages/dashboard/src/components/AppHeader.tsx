// packages/dashboard/src/components/AppHeader.tsx
// 앱 상단 헤더 — 타이틀, 세션 선택기, 연결 상태

import type { AgentId } from "../types";

interface Props {
  connected: boolean;
  agentCount: number;
  selectedAgent: AgentId | null;
  onClearFocus: () => void;
}

export function AppHeader({ connected, agentCount, selectedAgent, onClearFocus }: Props) {
  return (
    <div
      className="flex items-center justify-between px-4 flex-shrink-0"
      style={{
        height: 44,
        background: "var(--color-surface-base)",
        borderBottom: "1px solid var(--color-border-subtle)",
      }}
    >
      {/* 왼쪽: relay 워드마크 */}
      <div className="flex items-center gap-2">
        <span
          style={{
            fontSize: 15,
            fontWeight: 700,
            letterSpacing: "-0.04em",
            fontFamily: "var(--font-sans)",
            color: "var(--color-text-primary)",
          }}
        >
          relay
        </span>
        <span
          className="font-mono"
          style={{
            fontSize: 9,
            background: "var(--color-surface-overlay)",
            color: "var(--color-text-tertiary)",
            padding: "2px 6px",
            borderRadius: 9999,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}
        >
          dashboard
        </span>
      </div>

      {/* 가운데: Focus Mode 배지 (선택된 에이전트가 있을 때) */}
      {selectedAgent && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "4px 12px",
            borderRadius: 9999,
            background: "rgba(96,165,250,0.1)",
            border: "1px solid rgba(96,165,250,0.25)",
          }}
        >
          <span
            style={{
              fontSize: 11,
              fontWeight: 500,
              color: "#60a5fa",
            }}
          >
            Focus: {selectedAgent}
          </span>
          <button
            type="button"
            onClick={onClearFocus}
            style={{
              fontSize: 12,
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
      <div className="flex items-center gap-3">
        {/* 에이전트 수 배지 */}
        {agentCount > 0 && (
          <span
            className="font-mono"
            style={{
              fontSize: 10,
              background: "var(--color-surface-overlay)",
              color: "var(--color-text-tertiary)",
              padding: "2px 8px",
              borderRadius: 9999,
            }}
          >
            {agentCount} agents
          </span>
        )}

        {/* 연결 상태 */}
        {/* biome-ignore lint/a11y/useSemanticElements: div 레이아웃 필요 */}
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
            }}
          >
            {connected ? "live" : "offline"}
          </span>
        </div>
      </div>
    </div>
  );
}
