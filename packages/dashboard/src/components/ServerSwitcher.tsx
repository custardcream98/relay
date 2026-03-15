// packages/dashboard/src/components/ServerSwitcher.tsx
// Server selector for multi-instance relay setups.
// Renders null when only one server is present — zero UI cost for single-server users.

import { useEffect, useRef, useState } from "react";
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
      style={{
        display: "inline-block",
        width: 6,
        height: 6,
        borderRadius: "50%",
        background: color,
        flexShrink: 0,
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
    <div ref={containerRef} style={{ position: "relative", display: "flex", alignItems: "center" }}>
      {/* Server chip trigger */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 5,
          padding: "3px 8px",
          borderRadius: 4,
          background: "var(--color-surface-overlay)",
          border: `1px solid ${open ? "var(--color-border-default)" : "var(--color-border-subtle)"}`,
          cursor: "pointer",
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          color: "var(--color-text-secondary)",
          transition: "border-color 0.15s",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--color-border-default)";
        }}
        onMouseLeave={(e) => {
          if (!open) {
            (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--color-border-subtle)";
          }
        }}
      >
        {activeEntry && <StatusDot status={activeEntry.status} />}
        <span>{activeEntry?.label ?? activeServer}</span>
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
          role="listbox"
          aria-label="Select relay server"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            width: 280,
            background: "var(--color-surface-raised)",
            border: "1px solid var(--color-border-default)",
            borderRadius: 8,
            boxShadow: "var(--shadow-dropdown)",
            zIndex: 100,
            padding: 8,
          }}
        >
          {/* Section label */}
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
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                width: "100%",
                padding: "7px 8px",
                borderRadius: 6,
                background: server.isActive ? "var(--color-accent-glow)" : "transparent",
                border: `1px solid ${server.isActive ? "var(--color-accent)" : "transparent"}`,
                cursor: server.isActive ? "default" : "pointer",
                textAlign: "left",
                transition: "background 0.1s",
              }}
              onMouseEnter={(e) => {
                if (!server.isActive) {
                  (e.currentTarget as HTMLButtonElement).style.background =
                    "var(--color-surface-overlay)";
                }
              }}
              onMouseLeave={(e) => {
                if (!server.isActive) {
                  (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                }
              }}
            >
              <StatusDot status={server.status} />
              <span
                style={{
                  flex: 1,
                  fontSize: 13,
                  color:
                    server.status === "offline"
                      ? "var(--color-text-disabled)"
                      : "var(--color-text-primary)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {server.label}
              </span>
              <span
                style={{
                  fontSize: 11,
                  fontFamily: "var(--font-mono)",
                  color: "var(--color-text-tertiary)",
                  flexShrink: 0,
                }}
              >
                {(() => {
                  try {
                    return new URL(server.url).port || "80";
                  } catch {
                    return "?";
                  }
                })()}
              </span>
              {server.isActive && (
                <span
                  style={{
                    fontSize: 9,
                    fontFamily: "var(--font-mono)",
                    color: "var(--color-accent)",
                    background: "var(--color-accent-glow)",
                    border: "1px solid var(--color-accent)",
                    padding: "1px 5px",
                    borderRadius: 9999,
                    letterSpacing: "0.05em",
                    flexShrink: 0,
                  }}
                >
                  active
                </span>
              )}
            </button>
          ))}

          {/* Divider */}
          <div
            style={{
              height: 1,
              background: "var(--color-border-subtle)",
              margin: "6px 0",
            }}
          />

          {/* Add server inline input */}
          <div style={{ padding: "2px 4px" }}>
            <div
              style={{
                fontSize: 10,
                fontFamily: "var(--font-mono)",
                color: "var(--color-text-disabled)",
                textTransform: "uppercase",
                letterSpacing: "0.07em",
                marginBottom: 4,
              }}
            >
              Add server
            </div>
            {addError && (
              <div
                style={{
                  fontSize: 10,
                  fontFamily: "var(--font-mono)",
                  color: "var(--color-server-dead, #f87171)",
                  marginBottom: 4,
                }}
                role="alert"
              >
                {addError}
              </div>
            )}
            <div style={{ display: "flex", gap: 6 }}>
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
                style={{
                  flex: 1,
                  padding: "4px 8px",
                  borderRadius: 4,
                  border: `1px solid ${addError ? "var(--color-server-dead, #f87171)" : "var(--color-border-subtle)"}`,
                  background: "var(--color-surface-overlay)",
                  color: "var(--color-text-primary)",
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  outline: "none",
                }}
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
                style={{
                  padding: "4px 10px",
                  borderRadius: 4,
                  border: "1px solid var(--color-border-default)",
                  background: "var(--color-surface-overlay)",
                  color: "var(--color-text-secondary)",
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  cursor: "pointer",
                }}
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
