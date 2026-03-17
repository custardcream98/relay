// packages/dashboard/src/components/OfflineBanner.tsx
// Shown while reconnecting or when all reconnect attempts are exhausted.

import { useConnection } from "../context/ConnectionContext";

export function OfflineBanner() {
  const { connected, reconnecting, maxRetriesExhausted, attempt, nextRetryIn, onRetryNow } =
    useConnection();

  if (connected) return null;

  if (maxRetriesExhausted) {
    return (
      <div className="flex items-center justify-center gap-[10px] px-4 py-[7px] bg-[var(--color-warning-bg)] text-[var(--color-warning-text)] text-xs font-medium shrink-0 border-b border-[var(--color-warning-border)]">
        <span className="text-sm">⚠</span>
        <span>Unable to connect to server. Check that relay is running.</span>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="ml-2 px-[10px] py-[2px] rounded border border-[var(--color-warning-text)] bg-transparent text-[var(--color-warning-text)] text-[11px] font-semibold cursor-pointer"
        >
          Reload page
        </button>
      </div>
    );
  }

  if (!reconnecting) return null;

  return (
    <div className="flex items-center justify-center gap-[10px] px-4 py-[7px] bg-[var(--color-warning-bg)] text-[var(--color-warning-text)] text-xs font-medium shrink-0 border-b border-[var(--color-warning-border)]">
      <span className="text-sm">⚠</span>
      <span>
        Connection lost — reconnecting in {nextRetryIn}s (attempt {attempt + 1}/5)
      </span>
      <button
        type="button"
        onClick={onRetryNow}
        className="ml-2 px-[10px] py-[2px] rounded border border-[var(--color-warning-text)] bg-transparent text-[var(--color-warning-text)] text-[11px] font-semibold cursor-pointer"
      >
        Retry now
      </button>
    </div>
  );
}
