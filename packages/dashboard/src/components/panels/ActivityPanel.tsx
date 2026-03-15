// packages/dashboard/src/components/panels/ActivityPanel.tsx
// Top-right activity area: panel header with entry count badge + ActivityFeed.
// Data is sourced from SessionContext; sizing state comes from PanelResizeContext.

import { usePanelLayout } from "../../context/PanelResizeContext";
import { useSession } from "../../context/SessionContext";
import { ActivityFeed } from "../ActivityFeed";

export function ActivityPanel() {
  const { timelinePct, taskBoardCollapsed } = usePanelLayout();
  const { timeline, selectedAgent, thinkingChunks, agentStatuses } = useSession();

  return (
    <div
      style={{
        flex: taskBoardCollapsed ? "1 1 0" : `0 0 ${timelinePct}%`,
        transition: "flex 200ms ease",
        minHeight: 0,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Panel header */}
      <div
        className="flex items-center justify-between shrink-0"
        style={{
          height: 36,
          borderBottom: "1px solid var(--color-border-subtle)",
          background: "var(--color-surface-base)",
          paddingLeft: 16,
          paddingRight: 8,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              fontSize: 11,
              fontWeight: 500,
              color: "var(--color-text-tertiary)",
              textTransform: "uppercase",
              letterSpacing: "0.07em",
            }}
          >
            Activity
          </span>
          <span
            className="font-mono"
            style={{
              fontSize: 11,
              background: "var(--color-surface-overlay)",
              color: "var(--color-text-secondary)",
              padding: "1px 6px",
              borderRadius: 9999,
            }}
          >
            {timeline.length}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <ActivityFeed
          entries={timeline}
          focusAgent={selectedAgent}
          thinkingChunks={thinkingChunks}
          agentStatuses={agentStatuses}
        />
      </div>
    </div>
  );
}
