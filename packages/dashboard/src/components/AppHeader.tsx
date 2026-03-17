// packages/dashboard/src/components/AppHeader.tsx
// App top header — shows instance info, session team badge, server switcher, and theme toggle.
// Reads all data from context hooks directly; no props.

import { useAgents } from "../context/AgentsContext";
import { useConnection } from "../context/ConnectionContext";
import { useServer } from "../context/ServerContext";
import { useSession } from "../context/SessionContext";
import { useTheme } from "../hooks/useTheme";
import { cn } from "../lib/cn";
import { ServerSwitcher } from "./ServerSwitcher";
import { SessionProgress } from "./SessionProgress";
import { SessionSelector } from "./SessionSelector";
import { SessionTeamBadge } from "./SessionTeamBadge";

export function AppHeader() {
  const { connected, reconnecting } = useConnection();
  const { selectedAgent, instanceId, instancePort, sessionTeam, liveSessionId, onSelectAgent } =
    useSession();
  const { servers, activeServer, onSwitchServer, onAddServer } = useServer();
  const { agents } = useAgents();
  const { theme, toggleTheme } = useTheme();

  // window.location.port is "" (empty string) on default ports 80/443 — use || not ??
  const portLabel = instancePort || window.location.port || "3456";
  const instanceLabel = instanceId
    ? `relay (${instanceId}) @ :${portLabel}`
    : `relay @ :${portLabel}`;

  return (
    <div
      className="flex items-center justify-between px-5 h-[52px] shrink-0 sticky top-0 z-50 border-b border-[var(--color-border-default)]"
      style={{
        background: "color-mix(in srgb, var(--color-surface-root) 88%, transparent)",
        backdropFilter: "blur(12px) saturate(1.2)",
        WebkitBackdropFilter: "blur(12px) saturate(1.2)",
      }}
    >
      {/* Left: relay_ wordmark + optional server switcher */}
      <div className="flex items-center gap-3">
        <div className="flex items-baseline gap-1">
          <span className="text-[15px] font-medium tracking-[-0.04em] font-mono text-[var(--color-text-primary)] flex items-baseline">
            relay
            <span className="text-[var(--color-accent)] font-normal animate-[blink_1.1s_step-end_infinite]">
              _
            </span>
          </span>

          {servers.length > 1 ? (
            <>
              <span className="text-[13px] text-[var(--color-text-disabled)] mx-0.5 self-center">
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
            <span className="text-[11px] font-mono text-[var(--color-text-disabled)] tracking-[0.02em] self-center">
              {instanceLabel}
            </span>
          )}
        </div>

        <span className="text-[10px] font-mono bg-[var(--color-accent-glow)] text-[var(--color-accent)] border border-[var(--color-accent)] px-2 py-[2px] rounded-full uppercase tracking-[0.08em] font-medium opacity-90">
          dashboard
        </span>
      </div>

      {/* Center: session progress + focus mode */}
      <div className="flex items-center gap-3">
        <SessionProgress />
        {selectedAgent && (
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--color-accent-glow)] border border-[var(--color-accent)]">
            <span className="text-[11px] font-medium font-mono text-[var(--color-accent)] tracking-[0.02em]">
              focus: {selectedAgent}
            </span>
            <button
              type="button"
              onClick={() => onSelectAgent(null)}
              className="text-sm text-[var(--color-text-tertiary)] bg-none border-none cursor-pointer px-[2px] leading-none"
              aria-label="Exit Focus Mode"
            >
              ×
            </button>
          </div>
        )}
      </div>

      {/* Right: session selector + session team badge + agent count + theme toggle + connection status */}
      <div className="flex items-center gap-4">
        <SessionSelector sessionId={liveSessionId} serverUrl={activeServer} />
        <SessionTeamBadge agents={sessionTeam} />

        {agents.length > 0 && (
          <span className="text-[11px] font-mono text-[var(--color-text-tertiary)] tracking-[0.04em]">
            {agents.length} agents
          </span>
        )}

        <button
          type="button"
          onClick={toggleTheme}
          title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          className="flex items-center justify-center w-7 h-7 rounded-md border border-[var(--color-border-default)] bg-transparent text-[var(--color-text-tertiary)] cursor-pointer text-sm shrink-0 transition-[background,border-color,color] duration-100 hover:bg-[var(--color-surface-overlay)] hover:text-[var(--color-text-secondary)]"
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
            className={cn(
              "w-1.5 h-1.5 rounded-full inline-block shrink-0",
              connected
                ? "bg-[var(--color-connection-live)] shadow-[0_0_0_2px_rgba(52,211,153,0.25)]"
                : "bg-[var(--color-connection-dead)]"
            )}
          />
          <span
            className={cn(
              "text-[11px] text-[var(--color-text-disabled)] font-mono tracking-[0.04em]",
              reconnecting && !connected && "animate-[blink_1.2s_step-end_infinite]"
            )}
          >
            {connected ? "live" : reconnecting ? "reconnecting..." : "offline"}
          </span>
        </div>
      </div>
    </div>
  );
}
