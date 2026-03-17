// packages/dashboard/src/components/panels/BottomPanel.tsx
// Bottom-right panel — shows AgentDetailPanel in focus mode, TaskBoard otherwise.
// TaskBoard collapse uses grid-template-rows animation (0fr ↔ 1fr).

import { usePanelLayout } from "../../context/PanelResizeContext";
import { useSession } from "../../context/SessionContext";
import { cn } from "../../lib/cn";
import { AgentDetailPanel } from "../AgentDetailPanel";
import { TaskBoard } from "../TaskBoard";

// Panel top label + optional badge
function PanelHeader({ label, badge }: { label: string; badge?: number | string }) {
  return (
    <div className="flex items-center justify-between px-4 shrink-0 h-9 border-b border-(--color-border-subtle) bg-(--color-surface-base)">
      <span className="text-[11px] font-medium text-(--color-text-tertiary) uppercase tracking-[0.07em]">
        {label}
      </span>
      {badge !== undefined && (
        <span className="font-mono text-[11px] bg-(--color-surface-overlay) text-(--color-text-secondary) px-1.5 py-px rounded-full">
          {badge}
        </span>
      )}
    </div>
  );
}

export function BottomPanel() {
  const { taskBoardCollapsed, isDraggingTimeline, onToggleTaskBoard } = usePanelLayout();
  const { tasks, messages, agentStatuses, thinkingChunks, selectedAgent } = useSession();

  const isFocusMode = selectedAgent !== null;

  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden",
        !isDraggingTimeline && "transition-[flex] duration-200 ease-[ease]"
      )}
      style={{
        flex: !isFocusMode && taskBoardCollapsed ? "0 0 36px" : "1 1 0",
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
          <div className="flex items-center justify-between shrink-0 h-9 border-t border-b border-(--color-border-subtle) bg-(--color-surface-base) pl-4 pr-2">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-medium text-(--color-text-tertiary) uppercase tracking-[0.07em]">
                Task Board
              </span>
              <span className="font-mono text-[11px] bg-(--color-surface-overlay) text-(--color-text-secondary) px-1.5 py-px rounded-full">
                {tasks.length}
              </span>
            </div>
            <button
              type="button"
              onClick={onToggleTaskBoard}
              title={taskBoardCollapsed ? "Expand Task Board" : "Collapse Task Board"}
              className="w-5 h-5 flex items-center justify-center rounded bg-none border-none cursor-pointer text-(--color-text-disabled) shrink-0"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="none"
                aria-hidden="true"
                className="transition-transform duration-200 ease-[ease]"
                style={{ transform: taskBoardCollapsed ? "rotate(180deg)" : "rotate(0deg)" }}
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
            className="flex-[1_1_0] transition-[grid-template-rows] duration-200 ease-[ease]"
            style={{
              display: "grid",
              gridTemplateRows: taskBoardCollapsed ? "0fr" : "1fr",
            }}
          >
            <div className="overflow-hidden min-h-0">
              <TaskBoard tasks={tasks} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
