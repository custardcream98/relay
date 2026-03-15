// packages/dashboard/src/components/panels/AgentArenaPanel.tsx
// Left panel wrapper: grid-animated content + always-visible 32px toggle rail (right side).
// Data is sourced from context hooks; resize state comes from PanelResizeContext.

import { useAgents } from "../../context/AgentsContext";
import { usePanelLayout } from "../../context/PanelResizeContext";
import { useSession } from "../../context/SessionContext";
import { AgentArena } from "../AgentArena";

export function AgentArenaPanel() {
  const { arenaWidth, arenaCollapsed, isDraggingArena, onToggleCollapse } = usePanelLayout();
  const { agents, agentsLoading, agentsError } = useAgents();
  const { agentStatuses, thinkingChunks, tasks, messages, selectedAgent, onSelectAgent } =
    useSession();

  const contentWidth = arenaWidth - 32;

  return (
    <div style={{ display: "flex", flexShrink: 0 }}>
      {/* Width-animated content — collapses to 0 when hidden */}
      <div
        style={{
          width: arenaCollapsed ? 0 : contentWidth,
          overflow: "hidden",
          flexShrink: 0,
          transition: isDraggingArena ? "none" : "width 200ms ease",
        }}
      >
        <div style={{ width: contentWidth, height: "100%" }}>
          <AgentArena
            agents={agents}
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
      <div
        style={{
          width: 32,
          flexShrink: 0,
          borderRight: "1px solid var(--color-border-subtle)",
          background: "var(--color-surface-base)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <button
          type="button"
          onClick={onToggleCollapse}
          title={arenaCollapsed ? "Expand panel" : "Collapse panel"}
          style={{
            marginTop: 8,
            width: 24,
            height: 24,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 4,
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "var(--color-text-disabled)",
            flexShrink: 0,
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            aria-hidden="true"
            style={{
              transition: "transform 200ms ease",
              // Points left ← (collapse) when expanded; rotates to → (expand) when collapsed
              transform: arenaCollapsed ? "rotate(180deg)" : "rotate(0deg)",
            }}
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
