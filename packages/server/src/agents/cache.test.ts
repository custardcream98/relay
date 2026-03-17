// packages/server/src/agents/cache.ts tests
// Tests for getAgents path-traversal guard.
import { beforeEach, describe, expect, test } from "bun:test";
import { _invalidateCache, getAgents } from "./cache";

beforeEach(() => {
  _invalidateCache();
});

describe("getAgents — session ID validation", () => {
  test("returns null for a session ID containing path traversal characters", () => {
    const result = getAgents("../evil");
    expect(result).toBeNull();
  });

  test("returns null for a session ID with spaces", () => {
    expect(getAgents("bad id")).toBeNull();
  });

  test("returns null for a session ID with slashes", () => {
    expect(getAgents("a/b")).toBeNull();
  });

  test("returns null for a session ID with dots (path segment separator)", () => {
    expect(getAgents("..")).toBeNull();
  });

  test("returns empty object (not null) when called with no session ID", () => {
    // No session_id → pre-flight mode; returns {} not null
    const result = getAgents(undefined);
    expect(result).not.toBeNull();
    expect(result).toEqual({});
  });

  test("caches the result of the no-session call", () => {
    const first = getAgents(undefined);
    const second = getAgents(undefined);
    expect(first).toBe(second); // same reference = cached
  });
});

describe("getAgents — session file not found", () => {
  test("returns null when session file does not exist", () => {
    // Use a valid session ID that has no corresponding file
    const original = process.env.RELAY_DIR;
    process.env.RELAY_DIR = "/tmp/relay-cache-test-nonexistent-dir-12345";
    _invalidateCache();
    try {
      const result = getAgents("2026-03-16-001-abc1");
      expect(result).toBeNull();
    } finally {
      if (original === undefined) {
        delete process.env.RELAY_DIR;
      } else {
        process.env.RELAY_DIR = original;
      }
      _invalidateCache();
    }
  });
});
