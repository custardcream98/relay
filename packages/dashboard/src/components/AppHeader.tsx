// packages/dashboard/src/components/AppHeader.tsx
// App top header — shows instance info, session team badge, session switcher, and optional server switcher

import { memo, useCallback, useEffect, useRef, useState } from "react";
import type { AgentId, AgentMeta, ServerEntry } from "../types";
import { ServerSwitcher } from "./ServerSwitcher";
import { SessionTeamBadge } from "./SessionTeamBadge";

interface SessionRow {
  id: string;
  created_at: number; // unix seconds
  event_count: number;
}

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
  // Session switcher
  viewingSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
  onBackToLive: () => void;
  // Theme toggle
  theme: "dark" | "light";
  onToggleTheme: () => void;
}

function formatSessionDate(unixSec: number): string {
  return new Date(unixSec * 1000).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
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
  viewingSessionId,
  onSelectSession,
  onBackToLive,
  theme,
  onToggleTheme,
}: Props) {
  // Instance label: "relay (project-a) @ :3457" or "relay @ :3456"
  const portLabel = instancePort ?? window.location.port ?? "3456";
  const instanceLabel = instanceId
    ? `relay (${instanceId}) @ :${portLabel}`
    : `relay @ :${portLabel}`;

  // Session switcher dropdown state
  const [sessionDropdownOpen, setSessionDropdownOpen] = useState(false);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const sessionDropdownRef = useRef<HTMLDivElement>(null);

  const fetchSessions = useCallback(() => {
    setSessionsLoading(true);
    fetch("/api/sessions")
      .then((r) => r.json())
      .then((data: SessionRow[]) => {
        setSessions(data);
        setSessionsLoading(false);
      })
      .catch(() => setSessionsLoading(false));
  }, []);

  const handleSessionDropdownToggle = useCallback(() => {
    if (!sessionDropdownOpen) fetchSessions();
    setSessionDropdownOpen((v) => !v);
  }, [sessionDropdownOpen, fetchSessions]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (sessionDropdownRef.current && !sessionDropdownRef.current.contains(e.target as Node)) {
        setSessionDropdownOpen(false);
      }
    }
    if (sessionDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [sessionDropdownOpen]);

  const handleSessionSelect = useCallback(
    (sessionId: string) => {
      setSessionDropdownOpen(false);
      onSelectSession(sessionId);
    },
    [onSelectSession]
  );

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

      {/* Right: session switcher + session team badge + agent count + connection status */}
      <div className="flex items-center gap-4">
        {/* Session switcher dropdown */}
        <div ref={sessionDropdownRef} style={{ position: "relative" }}>
          {/* Back to Live button — shown only when viewing a historical session */}
          {viewingSessionId !== null && (
            <button
              type="button"
              onClick={onBackToLive}
              style={{
                marginRight: 6,
                padding: "3px 10px",
                borderRadius: 4,
                fontSize: 11,
                fontWeight: 600,
                cursor: "pointer",
                border: "1px solid #60a5fa",
                background: "#60a5fa18",
                color: "#60a5fa",
                letterSpacing: "0.03em",
              }}
            >
              ▶ Back to Live
            </button>
          )}

          {/* Session dropdown trigger */}
          <button
            type="button"
            onClick={handleSessionDropdownToggle}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              padding: "3px 10px",
              borderRadius: 4,
              fontSize: 11,
              fontWeight: 500,
              cursor: "pointer",
              border:
                viewingSessionId !== null
                  ? "1px solid #fbbf24"
                  : "1px solid var(--color-border-default)",
              background: viewingSessionId !== null ? "#fbbf2415" : "transparent",
              color: viewingSessionId !== null ? "#fbbf24" : "var(--color-text-tertiary)",
              fontFamily: "var(--font-mono)",
              letterSpacing: "0.03em",
              transition: "background 100ms, border-color 100ms, color 100ms",
            }}
          >
            {viewingSessionId !== null ? (
              // Viewing a historical session — show truncated session ID
              <span>
                {viewingSessionId.length > 20
                  ? `${viewingSessionId.slice(0, 20)}…`
                  : viewingSessionId}
              </span>
            ) : (
              // Live mode — green dot + LIVE label
              <>
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: "var(--color-connection-live)",
                    boxShadow: "0 0 0 2px rgba(52,211,153,0.25)",
                    display: "inline-block",
                    flexShrink: 0,
                  }}
                />
                LIVE
              </>
            )}
            <span style={{ fontSize: 9, opacity: 0.7 }}>▾</span>
          </button>

          {/* Sessions dropdown panel */}
          {sessionDropdownOpen && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 6px)",
                right: 0,
                minWidth: 280,
                background: "var(--color-surface-raised)",
                border: "1px solid var(--color-border-default)",
                borderRadius: 8,
                boxShadow: "var(--shadow-dropdown, 0 8px 24px rgba(0,0,0,0.35))",
                zIndex: 200,
                overflow: "hidden",
              }}
            >
              {/* Dropdown header */}
              <div
                style={{
                  padding: "8px 12px",
                  fontSize: 10,
                  fontWeight: 500,
                  color: "var(--color-text-disabled)",
                  textTransform: "uppercase",
                  letterSpacing: "0.07em",
                  borderBottom: "1px solid var(--color-border-subtle)",
                }}
              >
                Sessions
              </div>

              {/* Live option — always shown at top */}
              {/* biome-ignore lint/a11y/noStaticElementInteractions: session row acts as button */}
              {/* biome-ignore lint/a11y/useKeyWithClickEvents: session row acts as button */}
              <div
                onClick={() => {
                  setSessionDropdownOpen(false);
                  onBackToLive();
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "9px 12px",
                  cursor: "pointer",
                  borderBottom: "1px solid var(--color-border-subtle)",
                  background:
                    viewingSessionId === null ? "var(--color-surface-overlay)" : "transparent",
                  transition: "background 80ms",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLDivElement).style.background =
                    "var(--color-surface-overlay)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.background =
                    viewingSessionId === null ? "var(--color-surface-overlay)" : "transparent";
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: "var(--color-connection-live)",
                    boxShadow: "0 0 0 2px rgba(52,211,153,0.25)",
                    display: "inline-block",
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--color-text-primary)",
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  ● LIVE
                </span>
              </div>

              {/* Loading state */}
              {sessionsLoading && (
                <div
                  style={{
                    padding: "16px 12px",
                    fontSize: 12,
                    color: "var(--color-text-tertiary)",
                    textAlign: "center",
                  }}
                >
                  Loading…
                </div>
              )}

              {/* Empty state */}
              {!sessionsLoading && sessions.length === 0 && (
                <div
                  style={{
                    padding: "16px 12px",
                    fontSize: 12,
                    color: "var(--color-text-tertiary)",
                    textAlign: "center",
                  }}
                >
                  No past sessions
                </div>
              )}

              {/* Session list */}
              {!sessionsLoading &&
                sessions.map((session) => (
                  // biome-ignore lint/a11y/noStaticElementInteractions: session row acts as button
                  // biome-ignore lint/a11y/useKeyWithClickEvents: session row acts as button
                  <div
                    key={session.id}
                    onClick={() => handleSessionSelect(session.id)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "9px 12px",
                      cursor: "pointer",
                      borderBottom: "1px solid var(--color-border-subtle)",
                      background:
                        viewingSessionId === session.id
                          ? "var(--color-surface-overlay)"
                          : "transparent",
                      transition: "background 80ms",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLDivElement).style.background =
                        "var(--color-surface-overlay)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLDivElement).style.background =
                        viewingSessionId === session.id
                          ? "var(--color-surface-overlay)"
                          : "transparent";
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 500,
                          color: "var(--color-text-primary)",
                          fontFamily: "var(--font-mono)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {session.id}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: "var(--color-text-tertiary)",
                          marginTop: 2,
                        }}
                      >
                        {formatSessionDate(session.created_at)}
                      </div>
                    </div>
                    <span
                      className="font-mono"
                      style={{
                        fontSize: 10,
                        color: "var(--color-text-disabled)",
                        background: "var(--color-surface-overlay)",
                        padding: "1px 6px",
                        borderRadius: 3,
                        flexShrink: 0,
                        marginLeft: 8,
                      }}
                    >
                      {session.event_count} events
                    </span>
                  </div>
                ))}
            </div>
          )}
        </div>

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

        {/* Theme toggle button */}
        <button
          type="button"
          onClick={onToggleTheme}
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
