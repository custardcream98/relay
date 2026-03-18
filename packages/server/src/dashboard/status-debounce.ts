// packages/server/src/dashboard/status-debounce.ts
// Debounces agent:status broadcasts to reduce WebSocket noise.
// The same agent + same status within DEBOUNCE_MS is suppressed.

const lastStatusBroadcast = new Map<string, { status: string; at: number }>();
const STATUS_DEBOUNCE_MS = 5_000;

/** Maximum number of entries in the debounce map before eviction kicks in. */
const MAX_DEBOUNCE_ENTRIES = 1_000;

/** Entries older than this threshold are considered stale and eligible for cleanup. */
const STALE_THRESHOLD_MS = 60_000;

/**
 * Evict stale entries (older than STALE_THRESHOLD_MS) from the debounce map.
 * If the map still exceeds MAX_DEBOUNCE_ENTRIES after stale eviction,
 * remove the oldest entries until the cap is satisfied.
 */
function evictIfNeeded(): void {
  if (lastStatusBroadcast.size <= MAX_DEBOUNCE_ENTRIES) return;

  const now = Date.now();

  // First pass: remove stale entries
  for (const [key, entry] of lastStatusBroadcast) {
    if (now - entry.at > STALE_THRESHOLD_MS) {
      lastStatusBroadcast.delete(key);
    }
  }

  // If still over cap after stale eviction, remove oldest entries
  if (lastStatusBroadcast.size > MAX_DEBOUNCE_ENTRIES) {
    const sorted = [...lastStatusBroadcast.entries()].sort((a, b) => a[1].at - b[1].at);
    const toRemove = sorted.length - MAX_DEBOUNCE_ENTRIES;
    for (let i = 0; i < toRemove; i++) {
      lastStatusBroadcast.delete(sorted[i][0]);
    }
  }
}

/**
 * Returns true if the agent:status event should be broadcast.
 * Suppresses duplicate (agentId, status) pairs within STATUS_DEBOUNCE_MS.
 */
export function shouldBroadcastStatus(agentId: string, status: string): boolean {
  const last = lastStatusBroadcast.get(agentId);
  const now = Date.now();
  if (!last || last.status !== status || now - last.at > STATUS_DEBOUNCE_MS) {
    lastStatusBroadcast.set(agentId, { status, at: now });
    evictIfNeeded();
    return true;
  }
  return false;
}

/** Clear debounce state — for test isolation and session reset. */
export function _resetStatusDebounce(): void {
  lastStatusBroadcast.clear();
}

// Exported for testing only
export const _internals = {
  MAX_DEBOUNCE_ENTRIES,
  STALE_THRESHOLD_MS,
  STATUS_DEBOUNCE_MS,
  /** Returns current map size — for test assertions. */
  get size(): number {
    return lastStatusBroadcast.size;
  },
} as const;
