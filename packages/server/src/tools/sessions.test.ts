import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { _resetStore } from "../store";
import {
  handleGetOrchestratorState,
  handleGetSessionSummary,
  handleListSessions,
  handleSaveOrchestratorState,
  handleSaveSessionSummary,
} from "./sessions";

const TEST_DIR = join(import.meta.dir, "../../.relay-test");

describe("session tool", () => {
  beforeEach(() => mkdirSync(join(TEST_DIR, "sessions"), { recursive: true }));
  afterEach(() => rmSync(TEST_DIR, { recursive: true, force: true }));

  test("save session summary", async () => {
    const result = await handleSaveSessionSummary(TEST_DIR, {
      session_id: "2026-03-13-001",
      summary: "Shopping cart feature implementation complete. Watch out for auth header issues.",
    });
    expect(result.success).toBe(true);
  });

  test("retrieve session summary", async () => {
    await handleSaveSessionSummary(TEST_DIR, {
      session_id: "2026-03-13-001",
      summary: "test summary",
    });
    const result = await handleGetSessionSummary(TEST_DIR, { session_id: "2026-03-13-001" });
    expect(result.success).toBe(true);
    if (!result.success) throw new Error("unreachable");
    expect(result.summary).toContain("test summary");
    // Verify no heading prefix is injected — summary is stored verbatim
    expect(result.summary).not.toMatch(/^#/);
  });

  test("list sessions", async () => {
    await handleSaveSessionSummary(TEST_DIR, {
      session_id: "2026-03-13-001",
      summary: "first session",
    });
    const result = await handleListSessions(TEST_DIR);
    expect(result.sessions).toHaveLength(1);
    expect(result.sessions[0]).toBe("2026-03-13-001");
  });

  test("rejects invalid session_id with path traversal characters", async () => {
    const result = await handleSaveSessionSummary(TEST_DIR, {
      session_id: "../evil",
      summary: "payload",
    });
    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toContain("invalid ID format");
  });

  test("rejects invalid session_id with spaces", async () => {
    const result = await handleSaveSessionSummary(TEST_DIR, {
      session_id: "bad id",
      summary: "payload",
    });
    expect(result.success).toBe(false);
  });

  test("get session summary returns error for non-existent session", async () => {
    const result = await handleGetSessionSummary(TEST_DIR, { session_id: "does-not-exist" });
    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toContain("session not found");
  });

  test("get session summary rejects invalid session_id", async () => {
    const result = await handleGetSessionSummary(TEST_DIR, { session_id: "../etc/passwd" });
    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toContain("invalid ID format");
  });

  test("list sessions returns empty array when sessions dir does not exist", async () => {
    // Use a directory that has no sessions/ subdirectory
    const emptyDir = join(TEST_DIR, "no-sessions-here");
    mkdirSync(emptyDir, { recursive: true });
    const result = await handleListSessions(emptyDir);
    expect(result.success).toBe(true);
    expect(result.sessions).toHaveLength(0);
  });

  test("list sessions sorts most recent first", async () => {
    // Session IDs are date-based strings; reverse sort puts 002 before 001
    await handleSaveSessionSummary(TEST_DIR, {
      session_id: "2026-03-13-001",
      summary: "first",
    });
    await handleSaveSessionSummary(TEST_DIR, {
      session_id: "2026-03-13-002",
      summary: "second",
    });
    const result = await handleListSessions(TEST_DIR);
    expect(result.sessions[0]).toBe("2026-03-13-002");
    expect(result.sessions[1]).toBe("2026-03-13-001");
  });
});

describe("orchestrator state", () => {
  beforeEach(() => {
    _resetStore();
  });

  test("save then get returns same state string", () => {
    handleSaveOrchestratorState("sess-1", { agent_id: "orchestrator", state: '{"foo":"bar"}' });
    const result = handleGetOrchestratorState("sess-1", { agent_id: "orchestrator" });
    expect(result.success).toBe(true);
    expect(result.state).toBe('{"foo":"bar"}');
  });

  test("get on non-existent session returns null state", () => {
    const result = handleGetOrchestratorState("nonexistent", { agent_id: "orchestrator" });
    expect(result.success).toBe(true);
    expect(result.state).toBeNull();
  });

  test("save overwrites previous state", () => {
    handleSaveOrchestratorState("sess-1", { agent_id: "orchestrator", state: '{"v":1}' });
    handleSaveOrchestratorState("sess-1", { agent_id: "orchestrator", state: '{"v":2}' });
    const result = handleGetOrchestratorState("sess-1", { agent_id: "orchestrator" });
    expect(result.success).toBe(true);
    expect(result.state).toBe('{"v":2}');
  });

  test("_resetStore clears orchestrator states", () => {
    handleSaveOrchestratorState("sess-1", { agent_id: "orchestrator", state: '{"x":1}' });
    _resetStore();
    const result = handleGetOrchestratorState("sess-1", { agent_id: "orchestrator" });
    expect(result.success).toBe(true);
    expect(result.state).toBeNull();
  });
});
