// packages/dashboard/src/hooks/useResizablePanels.ts
// Hook for drag-to-resize panel widths

import { useCallback, useEffect, useRef, useState } from "react";

const MIN_PCT = 12;

export function useResizablePanels(count: number) {
  const [widths, setWidths] = useState<number[]>(() => Array(count).fill(100 / count));
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    handle: number;
    startX: number;
    startWidths: number[];
  } | null>(null);

  const startDrag = useCallback(
    (handle: number, e: React.MouseEvent) => {
      e.preventDefault();
      dragRef.current = { handle, startX: e.clientX, startWidths: widths.slice() };
      // Prevent text selection during drag
      document.body.style.userSelect = "none";
      document.body.style.cursor = "col-resize";
    },
    [widths]
  );

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const drag = dragRef.current;
      if (!drag || !containerRef.current) return;

      const total = containerRef.current.offsetWidth;
      const delta = ((e.clientX - drag.startX) / total) * 100;
      const w = drag.startWidths.slice();

      const left = Math.max(MIN_PCT, drag.startWidths[drag.handle] + delta);
      const right = Math.max(
        MIN_PCT,
        drag.startWidths[drag.handle] + drag.startWidths[drag.handle + 1] - left
      );
      w[drag.handle] = left;
      w[drag.handle + 1] = right;

      // Normalize to 100%
      const sum = w.reduce((a, b) => a + b, 0);
      setWidths(w.map((v) => (v / sum) * 100));
    };

    const onUp = () => {
      dragRef.current = null;
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  return { widths, containerRef, startDrag };
}
