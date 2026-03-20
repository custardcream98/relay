// packages/dashboard/src/components/OfflineBanner.tsx
// Shown while reconnecting or when all reconnect attempts are exhausted.
import { useConnection } from "../context/ConnectionContext";

export function OfflineBanner() {
  const { connected, reconnecting, maxRetriesExhausted, attempt, nextRetryIn, onRetryNow } =
    useConnection();

  if (connected) return null;

  if (maxRetriesExhausted) {
    return (
      <div className="flex shrink-0 items-center justify-center gap-[10px] border-b border-(--color-warning-border) bg-(--color-warning-bg) px-4 py-[7px] text-xs font-medium text-(--color-warning-text)">
        <span className="text-sm">⚠</span>
        <span>Unable to connect to server. Check that relay is running.</span>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="ml-2 cursor-pointer rounded border border-(--color-warning-text) bg-transparent px-[10px] py-[2px] text-[11px] font-semibold text-(--color-warning-text)"
        >
          Reload page
        </button>
      </div>
    );
  }

  if (!reconnecting) return null;

  return (
    <div className="flex shrink-0 items-center justify-center gap-[10px] border-b border-(--color-warning-border) bg-(--color-warning-bg) px-4 py-[7px] text-xs font-medium text-(--color-warning-text)">
      <span className="text-sm">⚠</span>
      <span>
        Connection lost — reconnecting in {nextRetryIn}s (attempt {attempt + 1}/5)
      </span>
      <button
        type="button"
        onClick={onRetryNow}
        className="ml-2 cursor-pointer rounded border border-(--color-warning-text) bg-transparent px-[10px] py-[2px] text-[11px] font-semibold text-(--color-warning-text)"
      >
        Retry now
      </button>
    </div>
  );
}
