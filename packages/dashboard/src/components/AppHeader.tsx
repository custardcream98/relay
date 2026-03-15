// packages/dashboard/src/components/AppHeader.tsx
// App top header — shows instance info, session team badge, server switcher, and theme toggle.
// Reads all data from context hooks directly; no props.

import { useAgents } from "../context/AgentsContext";
import { useConnection } from "../context/ConnectionContext";
import { useServer } from "../context/ServerContext";
import { useSession } from "../context/SessionContext";
import { useTheme } from "../hooks/useTheme";
import { ServerSwitcher } from "./ServerSwitcher";
import { SessionSelector } from "./SessionSelector";
import { SessionTeamBadge } from "./SessionTeamBadge";

export function AppHeader() {
  const { connected, reconnecting } = useConnection();
  const { selectedAgent, instanceId, instancePort, sessionTeam, liveSessionId, onSelectAgent } =
    useSession();
  const { servers, activeServer, onSwitchServer, onAddServer } = useServer();
  const { agents } = useAgents();
  const { theme, toggleTheme } = useTheme();

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
            onClick={() => onSelectAgent(null)}
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

      {/* Right: session selector + session team badge + agent count + theme toggle + connection status */}
      <div className="flex items-center gap-4">
        <SessionSelector sessionId={liveSessionId} serverUrl={activeServer} />
        <SessionTeamBadge agents={sessionTeam} />

        {agents.length > 0 && (
          <span
            style={{
              fontSize: 11,
              fontFamily: "var(--font-mono)",
              color: "var(--color-text-tertiary)",
              letterSpacing: "0.04em",
            }}
          >
            {agents.length} agents
          </span>
        )}

        <button
          type="button"
          onClick={toggleTheme}
          title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 28,
            height: 28,
            borderRadius: 6,
            border: "1px solid var(--color-border-default)",
            background: "transparent",
            color: "var(--color-text-tertiary)",
            cursor: "pointer",
            fontSize: 14,
            flexShrink: 0,
            transition: "background 100ms, border-color 100ms, color 100ms",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background =
              "var(--color-surface-overlay)";
            (e.currentTarget as HTMLButtonElement).style.color = "var(--color-text-secondary)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "transparent";
            (e.currentTarget as HTMLButtonElement).style.color = "var(--color-text-tertiary)";
          }}
        >
          {theme === "dark" ? "☀" : "☾"}
        </button>

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
              animation: reconnecting && !connected ? "blink 1.2s step-end infinite" : "none",
            }}
          >
            {connected ? "live" : reconnecting ? "reconnecting..." : "offline"}
          </span>
        </div>
      </div>
    </div>
  );
}
