// packages/dashboard/src/components/MobileTabBar.tsx
// Bottom tab bar for mobile layout — switches between Agents, Activity, and Tasks panels.

import type React from "react";
import { memo } from "react";
import { cn } from "../lib/cn";

export type MobileTab = "agents" | "activity" | "tasks";

interface TabDef {
  id: MobileTab;
  label: string;
  icon: React.ReactNode;
}

const TAB_DEFS: TabDef[] = [
  {
    id: "agents",
    label: "Agents",
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
        <circle cx="9" cy="6" r="3" stroke="currentColor" strokeWidth="1.5" />
        <path
          d="M3 15c0-3.3 2.7-5 6-5s6 1.7 6 5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    id: "activity",
    label: "Activity",
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
        <path
          d="M2 9h3l2-5 3 10 2-5h4"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    id: "tasks",
    label: "Tasks",
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
        <rect x="3" y="3" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
        <path
          d="M6 9l2 2 4-4"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
];

interface Props {
  activeTab: MobileTab;
  onTabChange: (tab: MobileTab) => void;
  badges: Partial<Record<MobileTab, number>>;
}

export const MobileTabBar = memo(function MobileTabBar({ activeTab, onTabChange, badges }: Props) {
  return (
    <nav
      className="flex items-center justify-around h-12 shrink-0 border-t border-(--color-border-default) bg-(--color-surface-base)"
      style={{
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      {TAB_DEFS.map((tab) => {
        const isActive = activeTab === tab.id;
        const badge = badges[tab.id];
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            className={cn(
              "flex flex-col items-center justify-center gap-0.5 flex-1 h-full border-none bg-transparent cursor-pointer transition-colors duration-100",
              isActive ? "text-(--color-accent)" : "text-(--color-text-disabled)"
            )}
            aria-label={tab.label}
            aria-current={isActive ? "page" : undefined}
          >
            <div className="relative">
              {tab.icon}
              {badge !== undefined && badge > 0 && (
                <span className="absolute -top-1 -right-2 min-w-[14px] h-[14px] flex items-center justify-center text-[8px] font-mono font-bold text-white bg-(--color-accent) rounded-full px-[3px] leading-none">
                  {badge > 99 ? "99+" : badge}
                </span>
              )}
            </div>
            <span className="text-[10px] font-medium tracking-[0.02em]">{tab.label}</span>
            {/* Active indicator — bottom bar */}
            {isActive && (
              <span className="absolute bottom-0 w-8 h-[2px] rounded-full bg-(--color-accent)" />
            )}
          </button>
        );
      })}
    </nav>
  );
});
