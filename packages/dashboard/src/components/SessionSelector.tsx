// packages/dashboard/src/components/SessionSelector.tsx
// Session selector dropdown — fetches the saved session list from /api/sessions
// and lets the user view the session ID and load a different session summary.
// Only shown when a live session ID is known.

import { useEffect, useRef, useState } from "react";
import { cn } from "../lib/cn";

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
    <div ref={containerRef} className="relative flex items-center">
      {/* Session ID chip — click to expand history */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={`Session: ${sessionId}\nClick to view session history`}
        className={cn(
          "flex items-center gap-[5px] px-2 py-[3px] rounded font-mono text-[11px] cursor-pointer transition-[border-color,background,color] duration-150",
          open
            ? "bg-[var(--color-surface-overlay)] border border-[var(--color-border-default)] text-[var(--color-text-tertiary)]"
            : "bg-transparent border border-[var(--color-border-subtle)] text-[var(--color-text-disabled)] hover:border-[var(--color-border-default)] hover:bg-[var(--color-surface-overlay)] hover:text-[var(--color-text-tertiary)]"
        )}
      >
        {/* Session icon */}
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="none"
          aria-hidden="true"
          className="shrink-0"
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
          className="text-[9px] text-[var(--color-text-disabled)] transition-transform duration-150"
          style={{ transform: open ? "rotate(180deg)" : "none" }}
        >
          ▾
        </span>
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute top-[calc(100%+6px)] right-0 w-[260px] bg-[var(--color-surface-raised)] border border-[var(--color-border-default)] rounded-lg shadow-[var(--shadow-dropdown)] z-[100] p-2">
          {/* Current session */}
          <div className="text-[10px] font-mono text-[var(--color-text-disabled)] uppercase tracking-[0.07em] px-1 pt-[2px] pb-1.5">
            Current session
          </div>
          <div className="px-2 py-1.5 rounded-[6px] bg-[var(--color-accent-glow)] border border-[var(--color-accent)] mb-1.5">
            <span className="text-[11px] font-mono text-[var(--color-accent)] break-all">
              {sessionId}
            </span>
          </div>

          {/* Saved sessions */}
          {sessions.length > 0 && (
            <>
              <div className="h-px bg-[var(--color-border-subtle)] my-1 mb-1.5" />
              <div className="text-[10px] font-mono text-[var(--color-text-disabled)] uppercase tracking-[0.07em] px-1 pt-[2px] pb-1">
                Saved sessions
              </div>
              <div className="max-h-[160px] overflow-y-auto flex flex-col gap-0.5">
                {sessions.map((s) => {
                  const isCurrent = s === sessionId;
                  return (
                    <div
                      key={s}
                      className={cn(
                        "px-2 py-[5px] rounded-[5px] text-[11px] font-mono break-all leading-[1.4] border",
                        isCurrent
                          ? "text-[var(--color-accent)] bg-[var(--color-accent-glow)] border-[var(--color-accent)]"
                          : "text-[var(--color-text-secondary)] bg-transparent border-transparent"
                      )}
                    >
                      {s}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {loading && (
            <div className="px-1 py-2 text-[11px] font-mono text-[var(--color-text-disabled)]">
              Loading...
            </div>
          )}

          {!loading && sessions.length === 0 && (
            <div className="px-1 py-1 text-[11px] text-[var(--color-text-disabled)] italic">
              No saved sessions yet.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
