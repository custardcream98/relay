// packages/dashboard/src/components/SessionSelector.tsx
// Session selector dropdown — fetches the saved session list from /api/sessions
// and lets the user view the session ID and load a different session summary.
// Only shown when a live session ID is known.

import { useEffect, useRef, useState } from "react";

interface Props {
  /** The currently active session ID (from session:snapshot) */
  sessionId: string | null;
  /** The base HTTP URL of the active relay server */
  serverUrl: string;
}

export function SessionSelector({ sessionId, serverUrl }: Props) {
  const [open, setOpen] = useState(false);
  const [sessions, setSessions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on Escape or outside click
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

  // Fetch sessions when the dropdown opens
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    const base = serverUrl.replace(/\/$/, "");
    fetch(`${base}/api/sessions`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<{ success: boolean; sessions: string[] }>;
      })
      .then((data) => {
        setSessions(data.sessions ?? []);
      })
      .catch(() => setSessions([]))
      .finally(() => setLoading(false));
  }, [open, serverUrl]);

  if (!sessionId) return null;

  // Shorten session ID for display — show last 12 chars to keep the header compact
  const shortId = sessionId.length > 16 ? `…${sessionId.slice(-12)}` : sessionId;

  return (
    <div ref={containerRef} style={{ position: "relative", display: "flex", alignItems: "center" }}>
      {/* Session ID chip — click to expand history */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={`Session: ${sessionId}\nClick to view session history`}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 5,
          padding: "3px 8px",
          borderRadius: 4,
          background: open ? "var(--color-surface-overlay)" : "transparent",
          border: `1px solid ${open ? "var(--color-border-default)" : "var(--color-border-subtle)"}`,
          cursor: "pointer",
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          color: "var(--color-text-disabled)",
          transition: "border-color 0.15s, background 0.15s",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--color-border-default)";
          (e.currentTarget as HTMLButtonElement).style.background = "var(--color-surface-overlay)";
          (e.currentTarget as HTMLButtonElement).style.color = "var(--color-text-tertiary)";
        }}
        onMouseLeave={(e) => {
          if (!open) {
            (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--color-border-subtle)";
            (e.currentTarget as HTMLButtonElement).style.background = "transparent";
            (e.currentTarget as HTMLButtonElement).style.color = "var(--color-text-disabled)";
          }
        }}
      >
        {/* Session icon */}
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="none"
          aria-hidden="true"
          style={{ flexShrink: 0 }}
        >
          <circle cx="5" cy="5" r="4" stroke="currentColor" strokeWidth="1.2" />
          <path
            d="M5 2.5V5L6.5 6.5"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
        </svg>
        <span>{shortId}</span>
        {/* Chevron */}
        <span
          style={{
            fontSize: 9,
            color: "var(--color-text-disabled)",
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform 0.15s",
          }}
        >
          ▾
        </span>
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            right: 0,
            width: 260,
            background: "var(--color-surface-raised)",
            border: "1px solid var(--color-border-default)",
            borderRadius: 8,
            boxShadow: "var(--shadow-dropdown)",
            zIndex: 100,
            padding: 8,
          }}
        >
          {/* Current session */}
          <div
            style={{
              fontSize: 10,
              fontFamily: "var(--font-mono)",
              color: "var(--color-text-disabled)",
              textTransform: "uppercase",
              letterSpacing: "0.07em",
              padding: "2px 4px 6px",
            }}
          >
            Current session
          </div>
          <div
            style={{
              padding: "6px 8px",
              borderRadius: 6,
              background: "var(--color-accent-glow)",
              border: "1px solid var(--color-accent)",
              marginBottom: 6,
            }}
          >
            <span
              style={{
                fontSize: 11,
                fontFamily: "var(--font-mono)",
                color: "var(--color-accent)",
                wordBreak: "break-all",
              }}
            >
              {sessionId}
            </span>
          </div>

          {/* Saved sessions */}
          {sessions.length > 0 && (
            <>
              <div
                style={{
                  height: 1,
                  background: "var(--color-border-subtle)",
                  margin: "4px 0 6px",
                }}
              />
              <div
                style={{
                  fontSize: 10,
                  fontFamily: "var(--font-mono)",
                  color: "var(--color-text-disabled)",
                  textTransform: "uppercase",
                  letterSpacing: "0.07em",
                  padding: "2px 4px 4px",
                }}
              >
                Saved sessions
              </div>
              <div
                style={{
                  maxHeight: 160,
                  overflowY: "auto",
                  display: "flex",
                  flexDirection: "column",
                  gap: 2,
                }}
              >
                {sessions.map((s) => {
                  const isCurrent = s === sessionId;
                  return (
                    <div
                      key={s}
                      style={{
                        padding: "5px 8px",
                        borderRadius: 5,
                        fontSize: 11,
                        fontFamily: "var(--font-mono)",
                        color: isCurrent ? "var(--color-accent)" : "var(--color-text-secondary)",
                        background: isCurrent ? "var(--color-accent-glow)" : "transparent",
                        border: `1px solid ${isCurrent ? "var(--color-accent)" : "transparent"}`,
                        wordBreak: "break-all",
                        lineHeight: 1.4,
                      }}
                    >
                      {s}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {loading && (
            <div
              style={{
                padding: "8px 4px",
                fontSize: 11,
                fontFamily: "var(--font-mono)",
                color: "var(--color-text-disabled)",
              }}
            >
              Loading...
            </div>
          )}

          {!loading && sessions.length === 0 && (
            <div
              style={{
                padding: "4px 4px",
                fontSize: 11,
                color: "var(--color-text-disabled)",
                fontStyle: "italic",
              }}
            >
              No saved sessions yet.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
