// packages/dashboard/src/components/activity/helpers.ts
// Helper functions for ActivityFeed

import type { FilterableType } from "./constants";
import { FILTER_DEFS, FILTER_STORAGE_KEY, VALID_FILTER_TYPES } from "./constants";

export function buildDefaultFilters(): Set<FilterableType> {
  try {
    const stored = localStorage.getItem(FILTER_STORAGE_KEY);
    if (stored) {
      const parsed: unknown = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        // Validate each element against known filter types to prevent stale/corrupted values
        const valid = parsed.filter(
          (item): item is FilterableType => typeof item === "string" && VALID_FILTER_TYPES.has(item)
        );
        if (valid.length > 0) return new Set(valid);
      }
    }
  } catch {
    // Ignore storage errors
  }
  return new Set(FILTER_DEFS.filter((f) => f.defaultOn).map((f) => f.type));
}

// Detect end: declaration type from message content
export function getEndDeclarationType(content: string): "done" | "waiting" | "failed" | null {
  if (content.startsWith("end:_done")) return "done";
  if (content.startsWith("end:failed")) return "failed";
  if (content.startsWith("end:waiting")) return "waiting";
  return null;
}
