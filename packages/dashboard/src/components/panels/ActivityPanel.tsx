// packages/dashboard/src/components/panels/ActivityPanel.tsx
// Top-right activity area: tab-switched panel — Activity feed or Message feed.
// Data is sourced from SessionContext; sizing state comes from PanelResizeContext.

import { useState } from "react";
import { usePanelLayout } from "../../context/PanelResizeContext";
import { useSession } from "../../context/SessionContext";
import { ActivityFeed } from "../ActivityFeed";
import { MessageFeed } from "../MessageFeed";

type PanelTab = "activity" | "messages";

export function ActivityPanel() {
  const { timelinePct, taskBoardCollapsed } = usePanelLayout();
  const { timeline, messages, selectedAgent, thinkingChunks, agentStatuses } = useSession();
  const [activeTab, setActiveTab] = useState<PanelTab>("activity");

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
      {/* Panel header — tab switcher */}
      <div
        className="flex items-center shrink-0"
        style={{
          height: 36,
          borderBottom: "1px solid var(--color-border-subtle)",
          background: "var(--color-surface-base)",
          paddingLeft: 12,
          paddingRight: 8,
          gap: 2,
        }}
      >
        {(
          [
            { id: "activity" as PanelTab, label: "Activity", count: timeline.length },
            { id: "messages" as PanelTab, label: "Messages", count: messages.length },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              padding: "3px 9px",
              borderRadius: 4,
              fontSize: 11,
              fontWeight: 500,
              cursor: "pointer",
              border: "none",
              background: activeTab === tab.id ? "var(--color-surface-overlay)" : "transparent",
              color:
                activeTab === tab.id ? "var(--color-text-secondary)" : "var(--color-text-disabled)",
              transition: "background 100ms, color 100ms",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            {tab.label}
            <span
              className="font-mono"
              style={{
                fontSize: 10,
                background:
                  activeTab === tab.id
                    ? "var(--color-surface-raised)"
                    : "var(--color-surface-overlay)",
                color:
                  activeTab === tab.id
                    ? "var(--color-text-secondary)"
                    : "var(--color-text-disabled)",
                padding: "0 4px",
                borderRadius: 3,
              }}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-hidden">
        {activeTab === "activity" ? (
          <ActivityFeed
            entries={timeline}
            focusAgent={selectedAgent}
            thinkingChunks={thinkingChunks}
            agentStatuses={agentStatuses}
          />
        ) : (
          <MessageFeed messages={messages} />
        )}
      </div>
    </div>
  );
}
