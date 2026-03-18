// packages/dashboard/src/hooks/usePopover.ts
// Shared popover behavior — Escape close, outside-click close, optional focus trap.

import { type RefObject, useEffect, useRef } from "react";

// CSS selector for all natively focusable elements
const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface UsePopoverOptions {
  /** Enable Tab/Shift+Tab cycling within the ref element and auto-focus first focusable on mount. */
  focusTrap?: boolean;
  /** When false, no listeners are attached. Defaults to true. Useful for popovers that toggle open/closed. */
  enabled?: boolean;
}

/**
 * Side-effect-only hook for popover/modal dismiss behavior.
 *
 * - Escape key → calls `onClose`
 * - Mousedown outside `ref` → calls `onClose`
 * - When `focusTrap: true`: traps Tab/Shift+Tab within `ref` and focuses the first focusable element on mount
 *
 * When `focusTrap` is enabled, the mousedown listener uses the capture phase so the click
 * registers before React synthetic events (matching the existing modal behavior).
 */
export function usePopover(
  ref: RefObject<HTMLElement | null>,
  onClose: () => void,
  options?: UsePopoverOptions
): void {
  const focusTrap = options?.focusTrap ?? false;
  const enabled = options?.enabled ?? true;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!enabled) return;

    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onCloseRef.current();
        return;
      }
      // Focus trap: keep Tab / Shift+Tab cycling within the container
      if (focusTrap && e.key === "Tab" && ref.current) {
        const focusable = Array.from(ref.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
        if (focusable.length === 0) {
          e.preventDefault();
          return;
        }
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    }

    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onCloseRef.current();
      }
    }

    document.addEventListener("keydown", handleKey);
    // Use capture phase for focus-trap modals so the click registers before React synthetic events
    document.addEventListener("mousedown", handleClick, focusTrap);

    // Auto-focus the first focusable element on mount when focus trapping is enabled
    if (focusTrap) {
      const firstFocusable = ref.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      firstFocusable?.focus();
    }

    return () => {
      document.removeEventListener("keydown", handleKey);
      document.removeEventListener("mousedown", handleClick, focusTrap);
    };
  }, [ref, focusTrap, enabled]);
}
