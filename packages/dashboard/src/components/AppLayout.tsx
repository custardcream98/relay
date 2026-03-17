// packages/dashboard/src/components/AppLayout.tsx
// Pure layout shell — manages panel geometry only.
// Desktop: 3 panels side-by-side with resize dividers.
// Mobile (<768px): panels stack vertically, no drag-to-resize.

import { useCallback, useMemo, useState } from "react";
import { usePanelLayout } from "../context/PanelResizeContext";
import { useSession } from "../context/SessionContext";
import { cn } from "../lib/cn";
import { AppHeader } from "./AppHeader";
import type { MobileTab } from "./MobileTabBar";
import { MobileTabBar } from "./MobileTabBar";
import { OfflineBanner } from "./OfflineBanner";
import { ActivityPanel } from "./panels/ActivityPanel";
import { AgentArenaPanel } from "./panels/AgentArenaPanel";
import { BottomPanel } from "./panels/BottomPanel";

// Drag resize handle — desktop only
function Divider({
  orientation,
  onMouseDown,
}: {
  orientation: "horizontal" | "vertical";
  onMouseDown: (e: React.MouseEvent) => void;
}) {
  const isH = orientation === "horizontal";

  const dots = [0, 1, 2].map((i) => (
    <span
      key={i}
      className="w-[3px] h-[3px] rounded-full bg-(--color-border-default) shrink-0 transition-colors duration-150 group-hover:bg-(--color-text-disabled)"
    />
  ));

  return (
    <div
      onMouseDown={onMouseDown}
      title="Drag to resize panels"
      className={cn(
        "group shrink-0 items-center justify-center gap-[3px] hidden md:flex",
        "bg-(--color-border-subtle) transition-colors duration-150 hover:bg-(--color-border-default)",
        isH
          ? "w-[6px] self-stretch flex-col cursor-col-resize"
          : "h-[6px] flex-row cursor-row-resize"
      )}
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
    <div className="h-screen flex flex-col overflow-hidden bg-(--color-surface-root) text-(--color-text-primary)">
      <AppHeader />
      <OfflineBanner />

      {/* Desktop layout: horizontal panels with resize dividers */}
      <div className="hidden md:flex flex-1 overflow-hidden">
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

      {/* Mobile layout: single panel + bottom tab bar */}
      <MobileLayout />
    </div>
  );
}

// Mobile-only layout — single active panel + bottom tab navigation
function MobileLayout() {
  const { tasks, agentStatuses } = useSession();
  const [activeTab, setActiveTab] = useState<MobileTab>("activity");

  const handleTabChange = useCallback((tab: MobileTab) => {
    setActiveTab(tab);
  }, []);

  // Compute badges for each tab
  const badges = useMemo(() => {
    const workingCount = Object.values(agentStatuses).filter((s) => s === "working").length;
    const inProgressCount = tasks.filter((t) => t.status === "in_progress").length;
    return {
      agents: workingCount > 0 ? workingCount : undefined,
      activity: undefined, // Could track unread, but keep simple for now
      tasks: inProgressCount > 0 ? inProgressCount : undefined,
    } as Partial<Record<MobileTab, number>>;
  }, [agentStatuses, tasks]);

  return (
    <div className="flex md:hidden flex-col flex-1 overflow-hidden">
      {/* Active panel — only one rendered at a time */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {activeTab === "agents" && <AgentArenaPanel />}
        {activeTab === "activity" && <ActivityPanel />}
        {activeTab === "tasks" && <BottomPanel />}
      </div>

      {/* Bottom tab bar */}
      <MobileTabBar activeTab={activeTab} onTabChange={handleTabChange} badges={badges} />
    </div>
  );
}
