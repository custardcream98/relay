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
// Gripper dots provide a visible affordance for the draggable area.
function Divider({
  orientation,
  onMouseDown,
}: {
  orientation: "horizontal" | "vertical";
  onMouseDown: (e: React.MouseEvent) => void;
}) {
  const isH = orientation === "horizontal";

  // Render 3 gripper dots aligned along the drag axis
  const dots = [0, 1, 2].map((i) => (
    <span
      key={i}
      style={{
        width: 3,
        height: 3,
        borderRadius: "50%",
        background: "var(--color-border-default)",
        flexShrink: 0,
        transition: "background 0.15s",
      }}
    />
  ));

  return (
    <div
      onMouseDown={onMouseDown}
      title={isH ? "Drag to resize panels" : "Drag to resize panels"}
      style={{
        [isH ? "width" : "height"]: 6,
        ...(isH ? { alignSelf: "stretch" } : {}),
        flexShrink: 0,
        cursor: isH ? "col-resize" : "row-resize",
        background: "var(--color-border-subtle)",
        transition: "background 0.15s",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: isH ? "column" : "row",
        gap: 3,
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.background = "var(--color-border-default)";
        // Brighten gripper dots on hover
        const spans = (e.currentTarget as HTMLDivElement).querySelectorAll("span");
        for (const s of spans) {
          (s as HTMLSpanElement).style.background = "var(--color-text-disabled)";
        }
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.background = "var(--color-border-subtle)";
        const spans = (e.currentTarget as HTMLDivElement).querySelectorAll("span");
        for (const s of spans) {
          (s as HTMLSpanElement).style.background = "var(--color-border-default)";
        }
      }}
    >
      {dots}
    </div>
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
      style={{
        background: "var(--color-surface-root)",
        color: "var(--color-text-primary)",
        // Ensure panels never collapse below usable widths on narrow viewports
        minWidth: 480,
      }}
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
