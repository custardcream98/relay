// packages/dashboard/src/components/panels/AgentArenaPanel.tsx
// Left panel wrapper: grid-animated content + always-visible 32px toggle rail (right side).
// Data is sourced from context hooks; resize state comes from PanelResizeContext.

import { useMemo } from "react";
import { useAgents } from "../../context/AgentsContext";
import { usePanelLayout } from "../../context/PanelResizeContext";
import { useSession } from "../../context/SessionContext";
import { AgentArena } from "../AgentArena";

export function AgentArenaPanel() {
  const { arenaWidth, arenaCollapsed, isDraggingArena, onToggleCollapse } = usePanelLayout();
  const { agents, agentsLoading, agentsError } = useAgents();
  const {
    agentStatuses,
    thinkingChunks,
    tasks,
    messages,
    selectedAgent,
    onSelectAgent,
    sessionTeam,
  } = useSession();

  // Merge pool agents with session-only agents (e.g. writer2, writer3 via extends)
  const mergedAgents = useMemo(() => {
    const poolIds = new Set(agents.map((a) => a.id));
    const sessionOnly = sessionTeam.filter((a) => !poolIds.has(a.id));
    return [...agents, ...sessionOnly];
  }, [agents, sessionTeam]);

  const contentWidth = arenaWidth - 32;

  return (
    <div className="flex shrink-0">
      {/* Width-animated content — collapses to 0 when hidden */}
      <div
        className="overflow-hidden shrink-0"
        style={{
          width: arenaCollapsed ? 0 : contentWidth,
          transition: isDraggingArena ? "none" : "width 200ms ease",
        }}
      >
        <div style={{ width: contentWidth, height: "100%" }}>
          <AgentArena
            agents={mergedAgents}
            agentsLoading={agentsLoading}
            agentsError={agentsError}
            statuses={agentStatuses}
            thinkingChunks={thinkingChunks}
            tasks={tasks}
            messages={messages}
            selectedAgent={selectedAgent}
            onSelectAgent={onSelectAgent}
          />
        </div>
      </div>

      {/* Always-visible toggle rail — right side of panel */}
      <div className="w-8 shrink-0 border-r border-(--color-border-subtle) bg-(--color-surface-base) flex flex-col items-center">
        <button
          type="button"
          onClick={onToggleCollapse}
          title={arenaCollapsed ? "Expand panel" : "Collapse panel"}
          className="mt-2 w-6 h-6 flex items-center justify-center rounded bg-none border-none cursor-pointer text-(--color-text-disabled) shrink-0"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            aria-hidden="true"
            className="transition-transform duration-200 ease-[ease]"
            style={{ transform: arenaCollapsed ? "rotate(180deg)" : "rotate(0deg)" }}
          >
            <path
              d="M9 3L5 7L9 11"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
