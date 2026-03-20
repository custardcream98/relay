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
import { SessionTeamBadge } from "./SessionTeamBadge";

/** 8-point star favicon icon — fill switches based on app theme */
function RelayStarIcon({ theme }: { theme: "dark" | "light" }) {
  const fill = theme === "dark" ? "#E8A83A" : "#C17F24";
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 128 128"
      width={16}
      height={16}
      aria-hidden="true"
      className="shrink-0"
    >
      <path
        fillRule="evenodd"
        d="M81 36 64 0 47 36l-1 2-9-10a6 6 0 0 0-9 9l10 10h-2L0 64l36 17h2L28 91a6 6 0 1 0 9 9l9-10 1 2 17 36 17-36v-2l9 10a6 6 0 1 0 9-9l-9-9 2-1 36-17-36-17-2-1 9-9a6 6 0 1 0-9-9l-9 10v-2Zm-17 2-2 5c-4 8-11 15-19 19l-5 2 5 2c8 4 15 11 19 19l2 5 2-5c4-8 11-15 19-19l5-2-5-2c-8-4-15-11-19-19l-2-5Z"
        clipRule="evenodd"
        fill={fill}
      />
      <path
        d="M118 19a6 6 0 0 0-9-9l-3 3a6 6 0 1 0 9 9l3-3Zm-96 4c-2 2-6 2-9 0l-3-3a6 6 0 1 1 9-9l3 3c3 2 3 6 0 9Zm0 82c-2-2-6-2-9 0l-3 3a6 6 0 1 0 9 9l3-3c3-2 3-6 0-9Zm96 4a6 6 0 0 1-9 9l-3-3a6 6 0 1 1 9-9l3 3Z"
        fill={fill}
      />
    </svg>
  );
}

export function AppHeader() {
  const { connected, reconnecting } = useConnection();
  const { selectedAgent, instanceId, instancePort, sessionTeam, onSelectAgent } = useSession();
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
      className="sticky top-0 z-50 flex h-[52px] shrink-0 items-center justify-between border-b border-(--color-border-default) px-5"
      style={{
        background: "color-mix(in srgb, var(--color-surface-root) 88%, transparent)",
        backdropFilter: "blur(12px) saturate(1.2)",
        WebkitBackdropFilter: "blur(12px) saturate(1.2)",
      }}
    >
      {/* Left: relay_ wordmark + optional server switcher */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-[5px]">
          <RelayStarIcon theme={theme} />
          <span className="flex items-baseline font-mono text-[15px] font-medium tracking-[-0.02em] text-(--color-text-primary)">
            relay
            <span className="animate-[blink_1.1s_step-end_infinite] font-normal text-(--color-accent)">
              _
            </span>
          </span>
        </div>

        {servers.length > 1 ? (
          <>
            <span className="mx-0.5 self-center text-[13px] text-(--color-text-disabled)">/</span>
            <ServerSwitcher
              servers={servers}
              activeServer={activeServer}
              onSwitch={onSwitchServer}
              onAdd={onAddServer}
            />
          </>
        ) : (
          <span className="self-center font-mono text-[11px] tracking-[0.02em] text-(--color-text-disabled)">
            {instanceLabel}
          </span>
        )}

        <span className="rounded-full border border-(--color-accent) bg-(--color-accent-glow) px-2 py-[2px] font-mono text-[10px] font-medium tracking-[0.08em] text-(--color-accent) uppercase opacity-90">
          dashboard
        </span>
      </div>

      {/* Center: session progress + focus mode */}
      <div className="flex items-center gap-3">
        <SessionProgress />
        {selectedAgent && (
          <div className="flex items-center gap-2 rounded-full border border-(--color-accent) bg-(--color-accent-glow) px-3 py-1">
            <span className="font-mono text-[11px] font-medium tracking-[0.02em] text-(--color-accent)">
              focus: {selectedAgent}
            </span>
            <button
              type="button"
              onClick={() => onSelectAgent(null)}
              className="cursor-pointer border-none bg-none px-[2px] text-sm leading-none text-(--color-text-tertiary)"
              aria-label="Exit Focus Mode"
            >
              ×
            </button>
          </div>
        )}
      </div>

      {/* Right: session team badge + agent count + theme toggle + connection status */}
      <div className="flex items-center gap-4">
        <SessionTeamBadge agents={sessionTeam} />

        {agents.length > 0 && (
          <span className="font-mono text-[11px] tracking-[0.04em] text-(--color-text-tertiary)">
            {agents.length} agents
          </span>
        )}

        <button
          type="button"
          onClick={toggleTheme}
          title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md border border-(--color-border-default) bg-transparent text-sm text-(--color-text-tertiary) transition-[background,border-color,color] duration-100 hover:bg-(--color-surface-overlay) hover:text-(--color-text-secondary)"
        >
          {theme === "dark" ? "☀" : "☾"}
        </button>

        <div
          className="flex items-center gap-1.5"
          role="status"
          aria-label={connected ? "Connected" : "Disconnected"}
        >
          <span
            className={cn(
              "inline-block h-1.5 w-1.5 shrink-0 rounded-full",
              connected
                ? "bg-(--color-connection-live) shadow-[0_0_0_2px_rgba(52,211,153,0.25)]"
                : "bg-(--color-connection-dead)"
            )}
          />
          <span
            className={cn(
              "font-mono text-[11px] tracking-[0.04em] text-(--color-text-disabled)",
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
