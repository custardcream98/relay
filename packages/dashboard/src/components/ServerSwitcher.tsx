// packages/dashboard/src/components/ServerSwitcher.tsx
// Server selector for multi-instance relay setups.
// Renders null when only one server is present — zero UI cost for single-server users.

import { useEffect, useRef, useState } from "react";
import { cn } from "../lib/cn";
import type { ServerEntry } from "../types";

interface Props {
  servers: ServerEntry[];
  activeServer: string;
  onSwitch: (url: string) => void;
  onAdd: (url: string) => void;
}

function StatusDot({ status }: { status: ServerEntry["status"] }) {
  const color =
    status === "live"
      ? "var(--color-server-live)"
      : status === "offline"
        ? "var(--color-server-dead)"
        : "var(--color-accent)";

  return (
    <span
      className="inline-block w-1.5 h-1.5 rounded-full shrink-0"
      style={{
        background: color,
        animation: status === "connecting" ? "server-connecting 1s step-end infinite" : undefined,
      }}
    />
  );
}

// Only http/https localhost or 127.0.0.1 are permitted to prevent SSRF via the Add Server input.
function isLocalhostUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const isLocalhost = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
    const isHttp = parsed.protocol === "http:" || parsed.protocol === "https:";
    return isLocalhost && isHttp;
  } catch {
    return false;
  }
}

export function ServerSwitcher({ servers, activeServer, onSwitch, onAdd }: Props) {
  const [open, setOpen] = useState(false);
  const [addInput, setAddInput] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click or Escape
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

  // Renders null for single-server setups — zero UI cost for current users
  if (servers.length <= 1) return null;

  const activeEntry = servers.find((s) => s.url === activeServer);

  return (
    <div ref={containerRef} className="relative flex items-center">
      {/* Server chip trigger */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center gap-[5px] px-2 py-[3px] rounded bg-[var(--color-surface-overlay)] cursor-pointer font-mono text-[11px] text-[var(--color-text-secondary)] transition-[border-color] duration-150",
          open
            ? "border border-[var(--color-border-default)]"
            : "border border-[var(--color-border-subtle)] hover:border-[var(--color-border-default)]"
        )}
      >
        {activeEntry && <StatusDot status={activeEntry.status} />}
        <span>{activeEntry?.label ?? activeServer}</span>
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
        <div
          role="listbox"
          aria-label="Select relay server"
          className="absolute top-[calc(100%+6px)] left-0 w-[280px] bg-[var(--color-surface-raised)] border border-[var(--color-border-default)] rounded-lg shadow-[var(--shadow-dropdown)] z-[100] p-2"
        >
          {/* Section label */}
          <div className="text-[10px] font-mono text-[var(--color-text-disabled)] uppercase tracking-[0.07em] px-1 pt-[2px] pb-1.5">
            Connected servers
          </div>

          {/* Server entries */}
          {servers.map((server) => (
            <button
              key={server.url}
              type="button"
              role="option"
              aria-selected={server.isActive}
              onClick={() => {
                if (!server.isActive) {
                  // Validate stored URLs on switch as a defense-in-depth measure
                  if (isLocalhostUrl(server.url)) {
                    onSwitch(server.url);
                  }
                }
                setOpen(false);
              }}
              className={cn(
                "flex items-center gap-2 w-full px-2 py-[7px] rounded-[6px] border text-left transition-[background] duration-100",
                server.isActive
                  ? "bg-[var(--color-accent-glow)] border-[var(--color-accent)] cursor-default"
                  : "bg-transparent border-transparent cursor-pointer hover:bg-[var(--color-surface-overlay)]"
              )}
            >
              <StatusDot status={server.status} />
              <span
                className={cn(
                  "flex-1 text-[13px] overflow-hidden text-ellipsis whitespace-nowrap",
                  server.status === "offline"
                    ? "text-[var(--color-text-disabled)]"
                    : "text-[var(--color-text-primary)]"
                )}
              >
                {server.label}
              </span>
              <span className="text-[11px] font-mono text-[var(--color-text-tertiary)] shrink-0">
                {(() => {
                  try {
                    return new URL(server.url).port || "80";
                  } catch {
                    return "?";
                  }
                })()}
              </span>
              {server.isActive && (
                <span className="text-[9px] font-mono text-[var(--color-accent)] bg-[var(--color-accent-glow)] border border-[var(--color-accent)] px-[5px] py-[1px] rounded-full tracking-[0.05em] shrink-0">
                  active
                </span>
              )}
            </button>
          ))}

          {/* Divider */}
          <div className="h-px bg-[var(--color-border-subtle)] my-1.5" />

          {/* Add server inline input */}
          <div className="px-1 py-[2px]">
            <div className="text-[10px] font-mono text-[var(--color-text-disabled)] uppercase tracking-[0.07em] mb-1">
              Add server
            </div>
            {addError && (
              <div
                className="text-[10px] font-mono text-[var(--color-server-dead)] mb-1"
                role="alert"
              >
                {addError}
              </div>
            )}
            <div className="flex gap-1.5">
              <input
                type="text"
                value={addInput}
                onChange={(e) => {
                  setAddInput(e.target.value);
                  setAddError(null);
                }}
                placeholder="localhost:3457"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && addInput.trim()) {
                    const raw = addInput.trim();
                    const url = raw.startsWith("http") ? raw : `http://${raw}`;
                    if (!isLocalhostUrl(url)) {
                      setAddError("Only localhost or 127.0.0.1 is allowed.");
                      return;
                    }
                    onAdd(url);
                    setAddInput("");
                    setAddError(null);
                    setOpen(false);
                  }
                }}
                className={cn(
                  "flex-1 px-2 py-1 rounded border bg-[var(--color-surface-overlay)] text-[var(--color-text-primary)] font-mono text-[11px] outline-none",
                  addError
                    ? "border-[var(--color-server-dead)]"
                    : "border-[var(--color-border-subtle)]"
                )}
              />
              <button
                type="button"
                onClick={() => {
                  if (addInput.trim()) {
                    const raw = addInput.trim();
                    const url = raw.startsWith("http") ? raw : `http://${raw}`;
                    if (!isLocalhostUrl(url)) {
                      setAddError("Only localhost or 127.0.0.1 is allowed.");
                      return;
                    }
                    onAdd(url);
                    setAddInput("");
                    setAddError(null);
                    setOpen(false);
                  }
                }}
                className="px-[10px] py-1 rounded border border-[var(--color-border-default)] bg-[var(--color-surface-overlay)] text-[var(--color-text-secondary)] font-mono text-[11px] cursor-pointer"
              >
                +
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
