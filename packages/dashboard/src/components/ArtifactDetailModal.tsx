// packages/dashboard/src/components/ArtifactDetailModal.tsx
// Artifact detail popover — fetches and displays artifact content on demand
import { useEffect, useRef, useState } from "react";

import { getAgentAccent } from "../constants/agents";
import { usePopover } from "../hooks/usePopover";
import { computePopoverStyle } from "../utils/popoverPosition";
import { MarkdownContent } from "./MarkdownContent";

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
  usePopover(modalRef, onClose, { focusTrap: true });

  const accentHex = artifact?.created_by ? getAgentAccent(artifact.created_by) : null;

  const popoverStyle = computePopoverStyle({
    anchorRect,
    width: 420,
    maxHeight: "min(500px, 70vh)",
  });

  return (
    <div
      ref={modalRef}
      style={popoverStyle}
      role="dialog"
      aria-modal="true"
      aria-label="Artifact detail"
    >
      {/* Header */}
      <div className="mb-1 flex items-start gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="text-sm">📄</span>
          <span className="flex-1 overflow-hidden font-mono text-[13px] leading-[1.45] font-medium text-ellipsis whitespace-nowrap text-(--color-text-primary)">
            {artifact?.name ?? artifactId}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close artifact detail"
          className="close-btn flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded border-none bg-transparent text-sm leading-none text-(--color-text-disabled)"
        >
          ×
        </button>
      </div>

      {/* Meta chips */}
      {artifact && (
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          <span className="rounded-full border border-(--color-border-subtle) bg-(--color-surface-overlay) px-[7px] py-[2px] font-mono text-[10px] font-medium tracking-[0.06em] text-(--color-text-tertiary) uppercase">
            {artifact.type}
          </span>
          {artifact.created_by && accentHex && (
            <span
              className="rounded-full px-[7px] py-[2px] font-mono text-[10px] font-medium"
              style={{
                color: accentHex,
                background: `${accentHex}1a`,
                border: `1px solid ${accentHex}40`,
              }}
            >
              {artifact.created_by}
            </span>
          )}
          <span className="font-mono text-[10px] text-(--color-text-disabled)">
            {new Date(artifact.created_at * 1000).toLocaleString()}
          </span>
        </div>
      )}

      {/* Content */}
      {loading && <p className="text-xs text-(--color-text-disabled) italic">Loading...</p>}
      {error && <p className="text-xs text-(--color-priority-critical) italic">{error}</p>}
      {artifact?.content && (
        <div className="max-h-[340px] overflow-y-auto rounded-[6px] border border-(--color-border-subtle) bg-(--color-surface-inset) p-[10px_12px]">
          <MarkdownContent text={artifact.content} />
        </div>
      )}
    </div>
  );
}
