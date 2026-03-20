// packages/dashboard/src/components/activity/EntryRenderer.tsx
// Route an entry to the correct renderer
import type { TimelineEntry } from "../../types";
import { ArtifactEntry } from "./ArtifactEntry";
import { MessageBroadcastEntry } from "./MessageBroadcastEntry";
import { MessageDirectEntry } from "./MessageDirectEntry";
import { ReviewEntry } from "./ReviewEntry";
import { ReviewUpdatedEntry } from "./ReviewUpdatedEntry";
import { SystemEntry } from "./SystemEntry";
import { TaskInlineEntry } from "./TaskInlineEntry";
import { ThinkingEntry } from "./ThinkingEntry";

export function EntryRenderer({
  entry,
  isFocused,
  entryId,
  isExpanded,
  onClickArtifact,
}: {
  entry: TimelineEntry;
  isFocused: boolean;
  entryId: string;
  isExpanded: boolean;
  onClickArtifact?: (artifactId: string, rect: DOMRect) => void;
}) {
  const focusStyle = isFocused
    ? "ring-1 ring-inset ring-(--color-accent) bg-[color-mix(in_srgb,var(--color-accent)_4%,transparent)]"
    : "";

  function renderContent() {
    switch (entry.type) {
      case "message:new": {
        const isBroadcast =
          entry.description === "Broadcast message" || !entry.description.startsWith("→");
        if (isBroadcast) return <MessageBroadcastEntry entry={entry} />;
        const toAgent = entry.description.slice(2).trim();
        return <MessageDirectEntry entry={entry} toAgent={toAgent} />;
      }
      case "task:updated":
        return <TaskInlineEntry entry={entry} />;
      case "artifact:posted":
        return <ArtifactEntry entry={entry} onClickArtifact={onClickArtifact} />;
      case "review:requested":
        return <ReviewEntry entry={entry} />;
      case "review:updated":
        return <ReviewUpdatedEntry entry={entry} />;
      case "agent:status":
      case "memory:updated":
      case "agent:joined":
        return <SystemEntry entry={entry} />;
      case "agent:thinking":
        // Thinking entries in the timeline are stale (replaced by thinkingChunks in real-time)
        // When expanded via Enter key, show full detail; otherwise render as system entry
        if (isExpanded && entry.detail)
          return (
            <ThinkingEntry agentId={entry.agentId ?? ""} chunk={entry.detail} isLive={false} />
          );
        return <SystemEntry entry={entry} />;
      default:
        return null;
    }
  }

  const content = renderContent();
  if (content === null) return null;

  return (
    <div id={entryId} className={focusStyle} role="option" aria-selected={isFocused} tabIndex={-1}>
      {content}
    </div>
  );
}
