// packages/dashboard/src/components/activity/FilterBar.tsx
// Filter bar component extracted from ActivityFeed.tsx for modularity.

import { memo, useRef, useState } from "react";
import { usePopover } from "../../hooks/usePopover";
import { cn } from "../../lib/cn";
import type { FilterableType } from "./constants";
import { FILTER_DEFS } from "./constants";

interface FilterBarProps {
  activeFilters: Set<FilterableType>;
  onToggleFilter: (type: FilterableType) => void;
  onToggleAll: () => void;
  countByType: Partial<Record<FilterableType, number>>;
}

export const FilterBar = memo(function FilterBar({
  activeFilters,
  onToggleFilter,
  onToggleAll,
  countByType,
}: FilterBarProps) {
  const filterBarRef = useRef<HTMLDivElement>(null);
  const [filterOpen, setFilterOpen] = useState(false);

  // Close filter panel on Escape or outside click
  usePopover(filterBarRef, () => setFilterOpen(false), { enabled: filterOpen });

  const isFiltered = activeFilters.size < FILTER_DEFS.length;
  const allOn = activeFilters.size === FILTER_DEFS.length;

  return (
    <div
      ref={filterBarRef}
      className="flex items-center gap-1 px-3 py-[5px] border-b border-(--color-border-subtle) bg-(--color-surface-base) shrink-0 flex-nowrap overflow-x-auto"
    >
      {/* Filter toggle button */}
      <button
        type="button"
        onClick={() => setFilterOpen((v) => !v)}
        title="Toggle filter panel"
        className={cn(
          "flex items-center gap-1 px-[7px] py-[2px] rounded text-[10px] font-medium cursor-pointer shrink-0 transition-[background,border-color,color] duration-100",
          isFiltered
            ? "text-(--color-accent-fe)"
            : "border border-(--color-border-subtle) bg-transparent text-(--color-text-tertiary)"
        )}
        style={
          isFiltered
            ? {
                border: "1px solid color-mix(in srgb, var(--color-accent-fe) 31%, transparent)",
                background: "color-mix(in srgb, var(--color-accent-fe) 8%, transparent)",
              }
            : undefined
        }
      >
        <span className="text-[11px]">⚙</span>
        Filter
        {isFiltered && (
          <span className="text-[9px] bg-(--color-accent-fe) text-white rounded-full px-1 font-semibold">
            {FILTER_DEFS.length - activeFilters.size} off
          </span>
        )}
      </button>

      {/* Filter pills — shown when open */}
      {filterOpen && (
        <>
          <button
            type="button"
            onClick={onToggleAll}
            className="px-[7px] py-[2px] rounded text-[10px] font-medium cursor-pointer border border-(--color-border-default) bg-transparent text-(--color-text-tertiary) shrink-0"
          >
            {allOn ? "All off" : "All on"}
          </button>

          {FILTER_DEFS.map((def) => {
            const isActive = activeFilters.has(def.type);
            const count = countByType[def.type] ?? 0;
            return (
              <button
                key={def.type}
                type="button"
                onClick={() => onToggleFilter(def.type)}
                title={`${def.label}${count > 0 ? ` (${count})` : ""}`}
                className={cn(
                  "flex items-center gap-[3px] px-[7px] py-[2px] rounded text-[10px] font-medium cursor-pointer shrink-0 transition-[background,border-color,color] duration-100",
                  isActive
                    ? "border border-(--color-border-default) bg-(--color-surface-overlay) text-(--color-text-secondary) opacity-100"
                    : "border border-(--color-border-subtle) bg-transparent text-(--color-text-disabled) opacity-50"
                )}
              >
                <span className="text-[11px]">{def.icon}</span>
                {def.label}
                {count > 0 && (
                  <span
                    className={cn(
                      "font-mono text-[9px] px-[3px] rounded-[3px]",
                      isActive
                        ? "bg-(--color-surface-raised) text-(--color-text-tertiary)"
                        : "bg-transparent text-(--color-text-disabled)"
                    )}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </>
      )}
    </div>
  );
});
