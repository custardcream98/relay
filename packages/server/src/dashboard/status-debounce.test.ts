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

  test("exposes correct constants via _internals", () => {
    expect(_internals.MAX_DEBOUNCE_ENTRIES).toBe(1_000);
    expect(_internals.STALE_THRESHOLD_MS).toBe(60_000);
    expect(_internals.STATUS_DEBOUNCE_MS).toBe(5_000);
  });
});
