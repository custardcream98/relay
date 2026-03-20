// packages/dashboard/src/utils/popoverPosition.ts
// Shared popover positioning logic — used by TaskDetailModal and ArtifactDetailModal.
// Handles mobile bottom-sheet and desktop anchored positioning.
import type React from "react";

interface PopoverPositionOptions {
  /** Anchor element rect for desktop positioning. Null = center on screen. */
  anchorRect: DOMRect | null;
  /** Popover width in px (desktop only). */
  width: number;
  /** CSS max-height string, e.g. "min(420px, 70vh)". */
  maxHeight: string;
  /** Optional border-top override, e.g. "3px solid var(--color-accent)". */
  borderTop?: string;
  /** Estimated popover height for above/below heuristic. Defaults to width + 20. */
  estimatedHeight?: number;
}

/**
 * Compute a complete CSSProperties object for a fixed popover.
 *
 * - Mobile (viewport < 768px): bottom-sheet style
 * - Desktop: anchored to `anchorRect` with space-above/space-below logic,
 *   or centered if no anchor is provided.
 */
export function computePopoverStyle(options: PopoverPositionOptions): React.CSSProperties {
  const { anchorRect, width, maxHeight, borderTop } = options;
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

  // Base styles shared across mobile and desktop
  const style: React.CSSProperties = {
    position: "fixed",
    background: "var(--color-surface-raised)",
    border: "1px solid var(--color-border-default)",
    boxShadow: "var(--shadow-modal)",
    zIndex: 200,
    padding: 16,
    borderTop: borderTop ?? "3px solid var(--color-accent)",
    animation: "task-modal-open 150ms ease-out both",
  };

  if (isMobile) {
    // Bottom sheet on mobile
    style.bottom = 0;
    style.left = 0;
    style.right = 0;
    style.width = "100%";
    style.maxHeight = "70vh";
    style.borderRadius = "12px 12px 0 0";
    style.overflowY = "auto";
  } else {
    style.width = width;
    style.maxHeight = maxHeight;
    style.overflowY = "auto";
    style.borderRadius = 8;

    if (anchorRect) {
      const spaceBelow = window.innerHeight - anchorRect.bottom;
      // Estimate popover height at roughly (width - a small offset) for the
      // space-above/space-below heuristic — matches both callers' original logic.
      const popoverHeight = options.estimatedHeight ?? width + 20;
      if (spaceBelow > popoverHeight || spaceBelow > window.innerHeight / 2) {
        style.top = anchorRect.bottom + 6;
      } else {
        style.bottom = window.innerHeight - anchorRect.top + 6;
      }
      const left = Math.min(anchorRect.left, window.innerWidth - (width + 8));
      style.left = Math.max(8, left);
    } else {
      style.top = "50%";
      style.left = "50%";
      style.transform = "translate(-50%, -50%)";
    }
  }

  return style;
}
