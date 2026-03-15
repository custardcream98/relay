// packages/dashboard/src/components/AppLayout.tsx
// Pure layout shell — manages panel geometry only.
// Reads PanelResizeContext for divider handlers and ref binding; all data from child panels via context.

import { usePanelLayout } from "../context/PanelResizeContext";
import { AppHeader } from "./AppHeader";
import { OfflineBanner } from "./OfflineBanner";
import { ActivityPanel } from "./panels/ActivityPanel";
import { AgentArenaPanel } from "./panels/AgentArenaPanel";
import { BottomPanel } from "./panels/BottomPanel";

// Drag resize handle — intentionally a div (hr cannot be sized in flex row/column)
function Divider({
  orientation,
  onMouseDown,
}: {
  orientation: "horizontal" | "vertical";
  onMouseDown: (e: React.MouseEvent) => void;
}) {
  const isH = orientation === "horizontal";
  return (
    <div
      onMouseDown={onMouseDown}
      style={{
        [isH ? "width" : "height"]: 4,
        ...(isH ? { alignSelf: "stretch" } : {}),
        flexShrink: 0,
        cursor: isH ? "col-resize" : "row-resize",
        background: "var(--color-border-subtle)",
        transition: "background 0.15s",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.background = "var(--color-border-default)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.background = "var(--color-border-subtle)";
      }}
    />
  );
}

export function AppLayout() {
  const {
    arenaCollapsed,
    activityRef,
    onHDividerMouseDown,
    onVDividerMouseDown,
    taskBoardCollapsed,
  } = usePanelLayout();

  return (
    <div
      className="h-screen flex flex-col overflow-hidden"
      style={{ background: "var(--color-surface-root)", color: "var(--color-text-primary)" }}
    >
      <AppHeader />
      <OfflineBanner />

      <div className="flex flex-1 overflow-hidden">
        <AgentArenaPanel />

        {!arenaCollapsed && <Divider orientation="horizontal" onMouseDown={onHDividerMouseDown} />}

        <div ref={activityRef} className="flex flex-col flex-1 overflow-hidden">
          <ActivityPanel />

          {!taskBoardCollapsed && (
            <Divider orientation="vertical" onMouseDown={onVDividerMouseDown} />
          )}

          <BottomPanel />
        </div>
      </div>
    </div>
  );
}
