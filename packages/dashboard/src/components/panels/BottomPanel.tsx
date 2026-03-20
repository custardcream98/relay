// packages/dashboard/src/components/panels/BottomPanel.tsx
// Bottom-right panel — shows AgentDetailPanel in focus mode, TaskBoard otherwise.
// TaskBoard collapse uses a single flex animation — no grid transition.
import { usePanelLayout } from "../../context/PanelResizeContext";
import { useSession } from "../../context/SessionContext";
import { cn } from "../../lib/cn";
import { AgentDetailPanel } from "../AgentDetailPanel";
import { TaskBoard } from "../TaskBoard";

// Panel top label + optional badge
function PanelHeader({ label, badge }: { label: string; badge?: number | string }) {
  return (
    <div className="flex h-9 shrink-0 items-center justify-between border-b border-(--color-border-subtle) bg-(--color-surface-base) px-4">
      <span className="text-[11px] font-medium tracking-[0.07em] text-(--color-text-tertiary) uppercase">
        {label}
      </span>
      {badge !== undefined && (
        <span className="rounded-full bg-(--color-surface-overlay) px-1.5 py-px font-mono text-[11px] text-(--color-text-secondary)">
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
          <div className="flex h-9 shrink-0 items-center justify-between border-t border-b border-(--color-border-subtle) bg-(--color-surface-base) pr-2 pl-4">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-medium tracking-[0.07em] text-(--color-text-tertiary) uppercase">
                Task Board
              </span>
              <span className="rounded-full bg-(--color-surface-overlay) px-1.5 py-px font-mono text-[11px] text-(--color-text-secondary)">
                {tasks.length}
              </span>
            </div>
            <button
              type="button"
              onClick={onToggleTaskBoard}
              title={taskBoardCollapsed ? "Expand Task Board" : "Collapse Task Board"}
              className="flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded border-none bg-none text-(--color-text-disabled)"
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

          {/* Content — clipped naturally by flex parent's collapse */}
          <div className="min-h-0 flex-1 overflow-hidden">
            <TaskBoard tasks={tasks} />
          </div>
        </>
      )}
    </div>
  );
}
