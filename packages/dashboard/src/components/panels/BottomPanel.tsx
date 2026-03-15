// packages/dashboard/src/components/panels/BottomPanel.tsx
// Bottom-right panel — shows AgentDetailPanel in focus mode, TaskBoard otherwise.
// TaskBoard collapse uses grid-template-rows animation (0fr ↔ 1fr).

import { usePanelLayout } from "../../context/PanelResizeContext";
import { useSession } from "../../context/SessionContext";
import { AgentDetailPanel } from "../AgentDetailPanel";
import { TaskBoard } from "../TaskBoard";

// Panel top label + optional badge
function PanelHeader({ label, badge }: { label: string; badge?: number | string }) {
  return (
    <div
      className="flex items-center justify-between px-4 shrink-0"
      style={{
        height: 36,
        borderBottom: "1px solid var(--color-border-subtle)",
        background: "var(--color-surface-base)",
      }}
    >
      <span
        style={{
          fontSize: 11,
          fontWeight: 500,
          color: "var(--color-text-tertiary)",
          textTransform: "uppercase",
          letterSpacing: "0.07em",
        }}
      >
        {label}
      </span>
      {badge !== undefined && (
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
          {badge}
        </span>
      )}
    </div>
  );
}

export function BottomPanel() {
  const { taskBoardCollapsed, onToggleTaskBoard } = usePanelLayout();
  const { tasks, messages, agentStatuses, thinkingChunks, selectedAgent } = useSession();

  const isFocusMode = selectedAgent !== null;

  return (
    <div
      style={{
        flex: !isFocusMode && taskBoardCollapsed ? "0 0 36px" : "1 1 0",
        transition: "flex 200ms ease",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        minHeight: 36,
      }}
    >
      {isFocusMode ? (
        <>
          <PanelHeader label={`${selectedAgent} — detail`} />
          <div className="flex-1 overflow-hidden">
            <AgentDetailPanel
              agentId={selectedAgent ?? ""}
              status={agentStatuses[selectedAgent ?? ""] ?? "idle"}
              thinkingChunk={thinkingChunks[selectedAgent ?? ""] ?? ""}
              messages={messages}
              tasks={tasks}
            />
          </div>
        </>
      ) : (
        <>
          {/* Single header — always rendered, chevron rotates on toggle */}
          <div
            className="flex items-center justify-between shrink-0"
            style={{
              height: 36,
              borderTop: "1px solid var(--color-border-subtle)",
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
                Task Board
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
                {tasks.length}
              </span>
            </div>
            <button
              type="button"
              onClick={onToggleTaskBoard}
              title={taskBoardCollapsed ? "Expand Task Board" : "Collapse Task Board"}
              style={{
                width: 20,
                height: 20,
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
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="none"
                aria-hidden="true"
                style={{
                  transition: "transform 200ms ease",
                  // Points down ↓ (collapse) when expanded; rotates to ↑ (expand) when collapsed
                  transform: taskBoardCollapsed ? "rotate(180deg)" : "rotate(0deg)",
                }}
              >
                <path
                  d="M2 4.5L6 8.5L10 4.5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>

          {/* Grid-animated content — 0fr collapsed, 1fr expanded */}
          <div
            style={{
              display: "grid",
              gridTemplateRows: taskBoardCollapsed ? "0fr" : "1fr",
              transition: "grid-template-rows 200ms ease",
              flex: "1 1 0",
            }}
          >
            <div style={{ overflow: "hidden", minHeight: 0 }}>
              <TaskBoard tasks={tasks} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
