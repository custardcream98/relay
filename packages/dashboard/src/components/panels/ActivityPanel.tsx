// packages/dashboard/src/components/panels/ActivityPanel.tsx
// Top-right activity area: tab-switched panel — Activity feed or Message feed.
// Data is sourced from SessionContext; sizing state comes from PanelResizeContext.

import { useState } from "react";
import { usePanelLayout } from "../../context/PanelResizeContext";
import { useSession } from "../../context/SessionContext";
import { cn } from "../../lib/cn";
import { ActivityFeed } from "../ActivityFeed";
import { MessageFeed } from "../MessageFeed";

type PanelTab = "activity" | "messages";

export function ActivityPanel() {
  const { timelinePct, taskBoardCollapsed } = usePanelLayout();
  const { timeline, messages, selectedAgent, thinkingChunks, agentStatuses } = useSession();
  const [activeTab, setActiveTab] = useState<PanelTab>("activity");

  return (
    <div
      className="min-h-0 overflow-hidden flex flex-col transition-[flex] duration-200 ease-[ease]"
      style={{
        flex: taskBoardCollapsed ? "1 1 0" : `0 0 ${timelinePct}%`,
      }}
    >
      {/* Panel header — tab switcher */}
      <div className="flex items-center shrink-0 h-9 border-b border-[var(--color-border-subtle)] bg-[var(--color-surface-base)] pl-3 pr-2 gap-0.5">
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
            className={cn(
              "flex items-center gap-[5px] px-[9px] py-[3px] rounded text-[11px] font-medium cursor-pointer border-none transition-[background,color] duration-100 uppercase tracking-[0.06em]",
              activeTab === tab.id
                ? "bg-[var(--color-surface-overlay)] text-[var(--color-text-secondary)]"
                : "bg-transparent text-[var(--color-text-disabled)]"
            )}
          >
            {tab.label}
            <span
              className={cn(
                "font-mono text-[10px] px-1 py-0 rounded-[3px]",
                activeTab === tab.id
                  ? "bg-[var(--color-surface-raised)] text-[var(--color-text-secondary)]"
                  : "bg-[var(--color-surface-overlay)] text-[var(--color-text-disabled)]"
              )}
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
