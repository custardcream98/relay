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
      className="flex shrink-0 flex-nowrap items-center gap-1 overflow-x-auto border-b border-(--color-border-subtle) bg-(--color-surface-base) px-3 py-[5px]"
    >
      {/* Filter toggle button */}
      <button
        type="button"
        onClick={() => setFilterOpen((v) => !v)}
        title="Toggle filter panel"
        className={cn(
          "flex shrink-0 cursor-pointer items-center gap-1 rounded px-[7px] py-[2px] text-[10px] font-medium transition-[background,border-color,color] duration-100",
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
          <span className="rounded-full bg-(--color-accent-fe) px-1 text-[9px] font-semibold text-white">
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
            className="shrink-0 cursor-pointer rounded border border-(--color-border-default) bg-transparent px-[7px] py-[2px] text-[10px] font-medium text-(--color-text-tertiary)"
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
                  "flex shrink-0 cursor-pointer items-center gap-[3px] rounded px-[7px] py-[2px] text-[10px] font-medium transition-[background,border-color,color] duration-100",
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
                      "rounded-[3px] px-[3px] font-mono text-[9px]",
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
