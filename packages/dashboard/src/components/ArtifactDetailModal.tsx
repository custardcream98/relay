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
