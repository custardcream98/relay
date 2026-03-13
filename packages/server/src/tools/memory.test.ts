import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { handleAppendMemory, handleReadMemory, handleWriteMemory } from "./memory";

const TEST_DIR = join(import.meta.dir, "../../.relay-test");

describe("memory tool", () => {
  beforeEach(() => mkdirSync(join(TEST_DIR, "memory/agents"), { recursive: true }));
  afterEach(() => rmSync(TEST_DIR, { recursive: true, force: true }));

  test("write_memory: saves agent memory", async () => {
    const result = await handleWriteMemory(TEST_DIR, {
      agent_id: "fe",
      key: "conventions",
      content: "Always separate server/client components",
    });
    expect(result.success).toBe(true);
    expect(existsSync(join(TEST_DIR, "memory/agents/fe.md"))).toBe(true);
  });

  test("read_memory: reads stored memory", async () => {
    await handleWriteMemory(TEST_DIR, {
      agent_id: "be",
      key: "api-pattern",
      content: "All responses use { data, error } structure",
    });
    const result = await handleReadMemory(TEST_DIR, { agent_id: "be" });
    expect(result.success).toBe(true);
    expect(result.content).toContain("All responses use { data, error } structure");
  });

  test("read_memory: returns null when not found", async () => {
    const result = await handleReadMemory(TEST_DIR, { agent_id: "da" });
    expect(result.success).toBe(true);
    expect(result.content).toBeNull();
  });

  test("append_memory: accumulates entries", async () => {
    await handleWriteMemory(TEST_DIR, {
      agent_id: "qa",
      key: "init",
      content: "First memory entry",
    });
    await handleAppendMemory(TEST_DIR, { agent_id: "qa", content: "Second memory entry" });
    const result = await handleReadMemory(TEST_DIR, { agent_id: "qa" });
    expect(result.content).toContain("First memory entry");
    expect(result.content).toContain("Second memory entry");
  });

  test("append_memory: saves to lessons.md when agent_id is omitted", async () => {
    await handleAppendMemory(TEST_DIR, { content: "Team retro: watch out for auth headers" });
    expect(existsSync(join(TEST_DIR, "memory/lessons.md"))).toBe(true);
    // Should not write to project.md
    expect(existsSync(join(TEST_DIR, "memory/project.md"))).toBe(false);
  });

  test("read_memory: merges project + lessons when agent_id is omitted", async () => {
    await handleWriteMemory(TEST_DIR, { key: "summary", content: "Project summary" });
    await handleAppendMemory(TEST_DIR, { content: "Lessons content" });
    const result = await handleReadMemory(TEST_DIR, {});
    expect(result.content).toContain("Project summary");
    expect(result.content).toContain("Lessons content");
  });

  test("write_memory: replaces section when same key is rewritten", async () => {
    await handleWriteMemory(TEST_DIR, {
      agent_id: "fe",
      key: "conventions",
      content: "Initial content",
    });
    await handleWriteMemory(TEST_DIR, {
      agent_id: "fe",
      key: "conventions",
      content: "Updated content",
    });
    const result = await handleReadMemory(TEST_DIR, { agent_id: "fe" });
    expect(result.content).toContain("Updated content");
    expect(result.content).not.toContain("Initial content");
  });

  test("write_memory: preserves existing sections when writing a different key", async () => {
    await handleWriteMemory(TEST_DIR, {
      agent_id: "fe",
      key: "conventions",
      content: "Convention content",
    });
    await handleWriteMemory(TEST_DIR, {
      agent_id: "fe",
      key: "patterns",
      content: "Pattern content",
    });
    const result = await handleReadMemory(TEST_DIR, { agent_id: "fe" });
    expect(result.content).toContain("Convention content");
    expect(result.content).toContain("Pattern content");
  });
});
