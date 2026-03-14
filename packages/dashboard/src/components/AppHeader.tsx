// packages/dashboard/src/components/AppHeader.tsx
// App top header — shows instance info, session team badge, and optional server switcher

import { memo } from "react";
import type { AgentId, AgentMeta, ServerEntry } from "../types";
import { ServerSwitcher } from "./ServerSwitcher";
import { SessionTeamBadge } from "./SessionTeamBadge";

interface Props {
  connected: boolean;
  reconnecting?: boolean; // 재연결 대기 중
  agentCount: number;
  selectedAgent: AgentId | null;
  onClearFocus: () => void;
  // Instance info — populated from session:snapshot once BE ships; defaults to current port
  instanceId?: string;
  instancePort?: number;
  // Current session team — populated from team:composed event or session:snapshot
  sessionTeam: AgentMeta[];
  // Multi-server support — populated from GET /api/servers; empty until BE ships
  servers: ServerEntry[];
  activeServer: string;
  onSwitchServer: (url: string) => void;
  onAddServer: (url: string) => void;
}

export const AppHeader = memo(function AppHeader({
  connected,
  reconnecting = false,
  agentCount,
  selectedAgent,
  onClearFocus,
  instanceId,
  instancePort,
  sessionTeam,
  servers,
  activeServer,
  onSwitchServer,
  onAddServer,
}: Props) {
  // Instance label: "relay (project-a) @ :3457" or "relay @ :3456"
  const portLabel = instancePort ?? window.location.port ?? "3456";
  const instanceLabel = instanceId
    ? `relay (${instanceId}) @ :${portLabel}`
    : `relay @ :${portLabel}`;

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
      {/* Left: relay_ wordmark + optional server switcher */}
      <div className="flex items-center gap-3">
        <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
          {/* relay_ wordmark */}
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

          {/* Separator + server switcher (multi-server) or instance label (single) */}
          {servers.length > 1 ? (
            <>
              <span
                style={{
                  fontSize: 13,
                  color: "var(--color-text-disabled)",
                  margin: "0 2px",
                  alignSelf: "center",
                }}
              >
                /
              </span>
              <ServerSwitcher
                servers={servers}
                activeServer={activeServer}
                onSwitch={onSwitchServer}
                onAdd={onAddServer}
              />
            </>
          ) : (
            <span
              style={{
                fontSize: 11,
                fontFamily: "var(--font-mono)",
                color: "var(--color-text-disabled)",
                letterSpacing: "0.02em",
                alignSelf: "center",
              }}
            >
              {instanceLabel}
            </span>
          )}
        </div>

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

      {/* Center: Focus Mode badge */}
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

      {/* Right: session team badge + agent count + connection status */}
      <div className="flex items-center gap-4">
        {/* Session team badge — shows when session has a composed team */}
        <SessionTeamBadge agents={sessionTeam} />

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
              // 재연결 중이면 깜빡임 애니메이션
              animation: reconnecting && !connected ? "blink 1.2s step-end infinite" : "none",
            }}
          >
            {connected ? "live" : reconnecting ? "reconnecting..." : "offline"}
          </span>
        </div>
      </div>
    </div>
  );
});
