// packages/dashboard/src/utils/time.ts

export function formatTime(unixSecs: number): string {
  return new Date(unixSecs * 1000).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function relativeTime(tsMs: number): string {
  const diffSec = Math.floor((Date.now() - tsMs) / 1000);
  if (diffSec < 5) return "just now";
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  return `${Math.floor(diffMin / 60)}h ago`;
}
