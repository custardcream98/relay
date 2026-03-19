// packages/server/src/dashboard/status-debounce.test.ts
// Tests for status debounce: cap enforcement, stale cleanup, and reset.
import { beforeEach, describe, expect, test } from "bun:test";
import { _internals, _resetStatusDebounce, shouldBroadcastStatus } from "./status-debounce";

describe("status-debounce", () => {
  beforeEach(() => {
    _resetStatusDebounce();
  });

  test("broadcasts the first status event for an agent", () => {
    expect(shouldBroadcastStatus("agent-1", "working")).toBe(true);
  });

  test("suppresses duplicate (agentId, status) within debounce window", () => {
    expect(shouldBroadcastStatus("agent-1", "working")).toBe(true);
    expect(shouldBroadcastStatus("agent-1", "working")).toBe(false);
  });

  test("broadcasts when status changes for the same agent", () => {
    expect(shouldBroadcastStatus("agent-1", "working")).toBe(true);
    expect(shouldBroadcastStatus("agent-1", "idle")).toBe(true);
  });

  test("broadcasts for different agents independently", () => {
    expect(shouldBroadcastStatus("agent-1", "working")).toBe(true);
    expect(shouldBroadcastStatus("agent-2", "working")).toBe(true);
  });

  test("_resetStatusDebounce clears all entries", () => {
    shouldBroadcastStatus("agent-1", "working");
    shouldBroadcastStatus("agent-2", "idle");
    expect(_internals.size).toBe(2);

    _resetStatusDebounce();
    expect(_internals.size).toBe(0);

    // After reset, same status should broadcast again
    expect(shouldBroadcastStatus("agent-1", "working")).toBe(true);
  });

  test("map does not exceed MAX_DEBOUNCE_ENTRIES", () => {
    const cap = _internals.MAX_DEBOUNCE_ENTRIES;

    // Fill the map beyond the cap
    for (let i = 0; i <= cap + 10; i++) {
      shouldBroadcastStatus(`agent-${i}`, "working");
    }

    // The eviction should have trimmed it back to at most the cap
    expect(_internals.size).toBeLessThanOrEqual(cap);
  });

  test("stale entries are evicted before LRU fallback when cap is exceeded", () => {
    const cap = _internals.MAX_DEBOUNCE_ENTRIES;
    const staleThreshold = _internals.STALE_THRESHOLD_MS;
    const now = Date.now();

    // Fill the map to exactly the cap
    for (let i = 0; i < cap; i++) {
      shouldBroadcastStatus(`agent-${i}`, "working");
    }
    expect(_internals.size).toBe(cap);

    // Manually backdate half the entries to make them stale (older than 60s)
    const staleCount = 500;
    for (let i = 0; i < staleCount; i++) {
      const entry = _internals.map.get(`agent-${i}`);
      if (entry) {
        entry.at = now - staleThreshold - 1_000; // 61s ago
      }
    }

    // Add one more entry to exceed cap and trigger eviction
    shouldBroadcastStatus("agent-trigger-eviction", "idle");

    // Stale entries should have been evicted
    // Remaining: (cap - staleCount) fresh entries + 1 new entry
    const expectedSize = cap - staleCount + 1;
    expect(_internals.size).toBe(expectedSize);

    // Verify the stale entries are actually gone
    for (let i = 0; i < staleCount; i++) {
      expect(_internals.map.has(`agent-${i}`)).toBe(false);
    }

    // Verify fresh entries survived
    for (let i = staleCount; i < cap; i++) {
      expect(_internals.map.has(`agent-${i}`)).toBe(true);
    }

    // Verify the trigger entry is present
    expect(_internals.map.has("agent-trigger-eviction")).toBe(true);
  });

  test("LRU fallback kicks in when stale eviction alone is insufficient", () => {
    const cap = _internals.MAX_DEBOUNCE_ENTRIES;

    // Fill beyond cap with all-fresh entries (no stale ones)
    // Since all entries are fresh, stale eviction removes nothing,
    // and the LRU fallback trims oldest entries.
    for (let i = 0; i <= cap + 10; i++) {
      shouldBroadcastStatus(`agent-${i}`, "working");
    }

    expect(_internals.size).toBeLessThanOrEqual(cap);

    // The oldest entries should have been evicted by LRU
    // At least the first 11 entries that pushed us over cap should be gone
    // (the exact count depends on eviction happening on each insert over cap)
  });

  test("exposes correct constants via _internals", () => {
    expect(_internals.MAX_DEBOUNCE_ENTRIES).toBe(1_000);
    expect(_internals.STALE_THRESHOLD_MS).toBe(60_000);
    expect(_internals.STATUS_DEBOUNCE_MS).toBe(5_000);
  });
});
