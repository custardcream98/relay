import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { handleGetSessionSummary, handleListSessions, handleSaveSessionSummary } from "./sessions";

const TEST_DIR = join(import.meta.dir, "../../.relay-test");

describe("session tool", () => {
  beforeEach(() => mkdirSync(join(TEST_DIR, "sessions"), { recursive: true }));
  afterEach(() => rmSync(TEST_DIR, { recursive: true, force: true }));

  test("save session summary", async () => {
    const result = await handleSaveSessionSummary(TEST_DIR, {
      session_id: "2026-03-13-001",
      summary: "Shopping cart feature implementation complete. Watch out for auth header issues.",
      tasks: [{ id: "t1", title: "Cart UI", status: "done" }],
      messages: [{ id: "m1", from_agent: "pm", content: "Work started" }],
    });
    expect(result.success).toBe(true);
    // Verify that messages.json was also saved
    expect(existsSync(join(TEST_DIR, "sessions/2026-03-13-001/messages.json"))).toBe(true);
  });

  test("retrieve session summary", async () => {
    await handleSaveSessionSummary(TEST_DIR, {
      session_id: "2026-03-13-001",
      summary: "test summary",
      tasks: [],
      messages: [],
    });
    const result = await handleGetSessionSummary(TEST_DIR, { session_id: "2026-03-13-001" });
    expect(result.success).toBe(true);
    if (!result.success) throw new Error("unreachable");
    expect(result.summary).toContain("test summary");
  });

  test("list sessions", async () => {
    await handleSaveSessionSummary(TEST_DIR, {
      session_id: "2026-03-13-001",
      summary: "first session",
      tasks: [],
      messages: [],
    });
    const result = await handleListSessions(TEST_DIR);
    expect(result.sessions).toHaveLength(1);
    expect(result.sessions[0]).toBe("2026-03-13-001");
  });
});
