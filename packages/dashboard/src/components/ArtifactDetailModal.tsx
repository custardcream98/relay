// packages/dashboard/src/components/ArtifactDetailModal.tsx
// Artifact detail popover — fetches and displays artifact content on demand
import { useEffect, useRef, useState } from "react";
import { getAgentAccent } from "../constants/agents";
import { MarkdownContent } from "./MarkdownContent";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface ArtifactDetail {
  id: string;
  name: string;
  type: string;
  content: string;
  created_by: string;
  task_id: string | null;
  created_at: number;
}

export function ArtifactDetailModal({
  artifactId,
  serverUrl,
  onClose,
  anchorRect,
}: {
  artifactId: string;
  serverUrl: string;
  onClose: () => void;
  anchorRect: DOMRect | null;
}) {
  const modalRef = useRef<HTMLDivElement>(null);
  const [artifact, setArtifact] = useState<ArtifactDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch artifact content
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    fetch(`${serverUrl}/api/artifacts/${artifactId}`, { signal: controller.signal })
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.artifact) {
          setArtifact(data.artifact);
        } else {
          setError(data.error ?? "Artifact not found");
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted) setError(err.message);
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [artifactId, serverUrl]);

  // Close on Escape or outside click; focus trap
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key === "Tab" && modalRef.current) {
        const focusable = Array.from(
          modalRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
        );
        if (focusable.length === 0) {
          e.preventDefault();
          return;
        }
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    }
    function handleClick(e: MouseEvent) {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("keydown", handleKey);
    document.addEventListener("mousedown", handleClick, true);
    const firstFocusable = modalRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    firstFocusable?.focus();
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.removeEventListener("mousedown", handleClick, true);
    };
  }, [onClose]);

  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
  const accentHex = artifact?.created_by ? getAgentAccent(artifact.created_by) : null;

  const popoverStyle: React.CSSProperties = {
    position: "fixed",
    background: "var(--color-surface-raised)",
    border: "1px solid var(--color-border-default)",
    boxShadow: "var(--shadow-modal)",
    zIndex: 200,
    padding: 16,
    borderTop: "3px solid var(--color-accent)",
    animation: "task-modal-open 150ms ease-out both",
  };

  if (isMobile) {
    popoverStyle.bottom = 0;
    popoverStyle.left = 0;
    popoverStyle.right = 0;
    popoverStyle.width = "100%";
    popoverStyle.maxHeight = "70vh";
    popoverStyle.borderRadius = "12px 12px 0 0";
    popoverStyle.overflowY = "auto";
  } else {
    popoverStyle.width = 420;
    popoverStyle.maxHeight = "min(500px, 70vh)";
    popoverStyle.overflowY = "auto";
    popoverStyle.borderRadius = 8;

    if (anchorRect) {
      const spaceBelow = window.innerHeight - anchorRect.bottom;
      const popoverHeight = 400;
      if (spaceBelow > popoverHeight || spaceBelow > window.innerHeight / 2) {
        popoverStyle.top = anchorRect.bottom + 6;
      } else {
        popoverStyle.bottom = window.innerHeight - anchorRect.top + 6;
      }
      const left = Math.min(anchorRect.left, window.innerWidth - 428);
      popoverStyle.left = Math.max(8, left);
    } else {
      popoverStyle.top = "50%";
      popoverStyle.left = "50%";
      popoverStyle.transform = "translate(-50%, -50%)";
    }
  }

  return (
    <div
      ref={modalRef}
      style={popoverStyle}
      role="dialog"
      aria-modal="true"
      aria-label="Artifact detail"
    >
      {/* Header */}
      <div className="flex items-start gap-2 mb-1">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-sm">📄</span>
          <span className="flex-1 text-[13px] font-medium font-mono leading-[1.45] text-(--color-text-primary) overflow-hidden text-ellipsis whitespace-nowrap">
            {artifact?.name ?? artifactId}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close artifact detail"
          className="close-btn shrink-0 w-5 h-5 flex items-center justify-center rounded border-none bg-transparent text-(--color-text-disabled) cursor-pointer text-sm leading-none"
        >
          ×
        </button>
      </div>

      {/* Meta chips */}
      {artifact && (
        <div className="flex gap-1.5 items-center mb-3 flex-wrap">
          <span className="text-[10px] font-mono font-medium px-[7px] py-[2px] rounded-full uppercase tracking-[0.06em] bg-(--color-surface-overlay) text-(--color-text-tertiary) border border-(--color-border-subtle)">
            {artifact.type}
          </span>
          {artifact.created_by && accentHex && (
            <span
              className="font-mono text-[10px] font-medium px-[7px] py-[2px] rounded-full"
              style={{
                color: accentHex,
                background: `${accentHex}1a`,
                border: `1px solid ${accentHex}40`,
              }}
            >
              {artifact.created_by}
            </span>
          )}
          <span className="text-[10px] font-mono text-(--color-text-disabled)">
            {new Date(artifact.created_at * 1000).toLocaleString()}
          </span>
        </div>
      )}

      {/* Content */}
      {loading && <p className="text-xs text-(--color-text-disabled) italic">Loading...</p>}
      {error && <p className="text-xs text-(--color-priority-critical) italic">{error}</p>}
      {artifact?.content && (
        <div className="bg-(--color-surface-inset) border border-(--color-border-subtle) rounded-[6px] p-[10px_12px] max-h-[340px] overflow-y-auto">
          <MarkdownContent text={artifact.content} />
        </div>
      )}
    </div>
  );
}
