// packages/server/src/agents/cache.ts tests
// Tests for getAgents path-traversal guard, getPool TTL, and loadPoolFile fallback.
import { beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { _invalidateCache, getAgents, loadPoolFile, POOL_CACHE_TTL_MS } from "./cache";

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

describe("loadPoolFile", () => {
  test("returns empty AgentsFile when no pool file exists", () => {
    const nonexistent = "/tmp/relay-cache-no-pool-dir-xyz";
    const result = loadPoolFile(nonexistent, nonexistent);
    expect(result).toEqual({ agents: {} });
  });

  test("reads pool file from relayDir/.relay/agents.pool.yml", () => {
    const tmpDir = join(tmpdir(), `relay-cache-test-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
    writeFileSync(
      join(tmpDir, "agents.pool.yml"),
      `agents:\n  analyst:\n    name: Analyst\n    emoji: 📊\n    tools: []\n    systemPrompt: Analyst.\n`
    );
    try {
      const result = loadPoolFile(tmpDir, "/nonexistent");
      expect(result.agents).toBeDefined();
      expect((result.agents as Record<string, unknown>).analyst).toBeDefined();
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test("falls back to projectRoot/agents.pool.yml when relayDir file absent", () => {
    const tmpDir = join(tmpdir(), `relay-cache-fallback-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
    writeFileSync(
      join(tmpDir, "agents.pool.yml"),
      `agents:\n  writer:\n    name: Writer\n    emoji: ✍️\n    tools: []\n    systemPrompt: Writer.\n`
    );
    try {
      const result = loadPoolFile("/nonexistent-relay-dir", tmpDir);
      expect((result.agents as Record<string, unknown>).writer).toBeDefined();
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test("returns empty AgentsFile on YAML parse error", () => {
    const tmpDir = join(tmpdir(), `relay-cache-bad-yaml-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
    writeFileSync(join(tmpDir, "agents.pool.yml"), "{ invalid yaml: [unclosed");
    try {
      const result = loadPoolFile(tmpDir, "/nonexistent");
      expect(result).toEqual({ agents: {} });
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

describe("POOL_CACHE_TTL_MS constant", () => {
  test("is 5 minutes (300000ms)", () => {
    expect(POOL_CACHE_TTL_MS).toBe(5 * 60 * 1000);
  });
});
