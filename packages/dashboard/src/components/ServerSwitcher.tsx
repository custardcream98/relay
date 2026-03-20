// packages/dashboard/src/components/ServerSwitcher.tsx
// Server selector for multi-instance relay setups.
// Renders null when only one server is present — zero UI cost for single-server users.
import { useCallback, useRef, useState } from "react";

import { usePopover } from "../hooks/usePopover";
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
      className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
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
  const handleClose = useCallback(() => setOpen(false), []);

  const handleAddSubmit = useCallback(() => {
    if (!addInput.trim()) return;
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
  }, [addInput, onAdd]);

  // Close on outside click or Escape
  usePopover(containerRef, handleClose, { enabled: open });

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
          "flex cursor-pointer items-center gap-[5px] rounded bg-(--color-surface-overlay) px-2 py-[3px] font-mono text-[11px] text-(--color-text-secondary) transition-[border-color] duration-150",
          open
            ? "border border-(--color-border-default)"
            : "border border-(--color-border-subtle) hover:border-(--color-border-default)"
        )}
      >
        {activeEntry && <StatusDot status={activeEntry.status} />}
        <span>{activeEntry?.label ?? activeServer}</span>
        {/* Chevron */}
        <span
          className="text-[9px] text-(--color-text-disabled) transition-transform duration-150"
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
          className="absolute top-[calc(100%+6px)] left-0 z-100 w-[280px] rounded-lg border border-(--color-border-default) bg-(--color-surface-raised) p-2 shadow-(--shadow-dropdown)"
        >
          {/* Section label */}
          <div className="px-1 pt-[2px] pb-1.5 font-mono text-[10px] tracking-[0.07em] text-(--color-text-disabled) uppercase">
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
                "flex w-full items-center gap-2 rounded-[6px] border px-2 py-[7px] text-left transition-[background] duration-100",
                server.isActive
                  ? "cursor-default border-(--color-accent) bg-(--color-accent-glow)"
                  : "cursor-pointer border-transparent bg-transparent hover:bg-(--color-surface-overlay)"
              )}
            >
              <StatusDot status={server.status} />
              <span
                className={cn(
                  "flex-1 overflow-hidden text-[13px] text-ellipsis whitespace-nowrap",
                  server.status === "offline"
                    ? "text-(--color-text-disabled)"
                    : "text-(--color-text-primary)"
                )}
              >
                {server.label}
              </span>
              <span className="shrink-0 font-mono text-[11px] text-(--color-text-tertiary)">
                {(() => {
                  try {
                    return new URL(server.url).port || "80";
                  } catch {
                    return "?";
                  }
                })()}
              </span>
              {server.isActive && (
                <span className="shrink-0 rounded-full border border-(--color-accent) bg-(--color-accent-glow) px-[5px] py-px font-mono text-[9px] tracking-[0.05em] text-(--color-accent)">
                  active
                </span>
              )}
            </button>
          ))}

          {/* Divider */}
          <div className="my-1.5 h-px bg-(--color-border-subtle)" />

          {/* Add server inline input */}
          <div className="px-1 py-[2px]">
            <div className="mb-1 font-mono text-[10px] tracking-[0.07em] text-(--color-text-disabled) uppercase">
              Add server
            </div>
            {addError && (
              <div className="mb-1 font-mono text-[10px] text-(--color-server-dead)" role="alert">
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
                  if (e.key === "Enter") handleAddSubmit();
                }}
                className={cn(
                  "flex-1 rounded border bg-(--color-surface-overlay) px-2 py-1 font-mono text-[11px] text-(--color-text-primary) outline-none",
                  addError ? "border-(--color-server-dead)" : "border-(--color-border-subtle)"
                )}
              />
              <button
                type="button"
                onClick={handleAddSubmit}
                className="cursor-pointer rounded border border-(--color-border-default) bg-(--color-surface-overlay) px-[10px] py-1 font-mono text-[11px] text-(--color-text-secondary)"
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
