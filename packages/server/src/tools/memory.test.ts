import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
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

  test("append_memory: returns error when agent_id is omitted", async () => {
    const result = await handleAppendMemory(TEST_DIR, {
      content: "Team retro: watch out for auth headers",
    });
    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toContain("save_session_summary");
    // lessons.md must not be created
    expect(existsSync(join(TEST_DIR, "memory/lessons.md"))).toBe(false);
  });

  test("read_memory: returns only project.md when agent_id is omitted", async () => {
    await handleWriteMemory(TEST_DIR, { key: "summary", content: "Project summary" });
    // Simulate a leftover lessons.md from a previous version
    writeFileSync(join(TEST_DIR, "memory/lessons.md"), "Old lessons content");
    const result = await handleReadMemory(TEST_DIR, {});
    expect(result.content).toContain("Project summary");
    expect(result.content).not.toContain("Old lessons content");
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

  // --- agent_id path-traversal rejection ---

  test("write_memory: rejects agent_id with path traversal characters", async () => {
    const result = await handleWriteMemory(TEST_DIR, {
      agent_id: "../evil",
      key: "conventions",
      content: "malicious",
    });
    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toContain("invalid ID format");
  });

  test("write_memory: rejects agent_id containing a slash", async () => {
    const result = await handleWriteMemory(TEST_DIR, {
      agent_id: "fe/hack",
      key: "conventions",
      content: "malicious",
    });
    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toContain("invalid ID format");
  });

  test("read_memory: rejects agent_id with invalid characters", async () => {
    const result = await handleReadMemory(TEST_DIR, { agent_id: "../etc/passwd" });
    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toContain("invalid ID format");
  });

  test("append_memory: rejects agent_id with path traversal characters", async () => {
    const result = await handleAppendMemory(TEST_DIR, {
      agent_id: "../../root",
      content: "malicious",
    });
    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toContain("invalid ID format");
  });

  // --- isValidMemoryKey edge cases ---

  test("write_memory: rejects empty key", async () => {
    const result = await handleWriteMemory(TEST_DIR, {
      agent_id: "fe",
      key: "",
      content: "some content",
    });
    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toContain("invalid key format");
  });

  test("write_memory: rejects key longer than 256 characters", async () => {
    const longKey = "a".repeat(257);
    const result = await handleWriteMemory(TEST_DIR, {
      agent_id: "fe",
      key: longKey,
      content: "some content",
    });
    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toContain("invalid key format");
  });

  test("write_memory: accepts key of exactly 256 characters", async () => {
    const maxKey = "a".repeat(256);
    const result = await handleWriteMemory(TEST_DIR, {
      agent_id: "fe",
      key: maxKey,
      content: "boundary content",
    });
    expect(result.success).toBe(true);
  });

  test("write_memory: rejects key containing a newline", async () => {
    const result = await handleWriteMemory(TEST_DIR, {
      agent_id: "fe",
      key: "valid-prefix\ninjected-header",
      content: "malicious",
    });
    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toContain("invalid key format");
  });

  test("write_memory: rejects key containing a carriage return", async () => {
    const result = await handleWriteMemory(TEST_DIR, {
      agent_id: "fe",
      key: "valid-prefix\rinjected",
      content: "malicious",
    });
    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toContain("invalid key format");
  });

  // --- write_memory without agent_id writes to project.md ---

  test("write_memory: writes to project.md when agent_id is omitted", async () => {
    const result = await handleWriteMemory(TEST_DIR, {
      key: "overview",
      content: "Project overview content",
    });
    expect(result.success).toBe(true);
    const { join: pathJoin } = await import("node:path");
    const { existsSync: fileExists } = await import("node:fs");
    expect(fileExists(pathJoin(TEST_DIR, "memory/project.md"))).toBe(true);
  });

  test("write_memory: project.md content is returned by read_memory without agent_id", async () => {
    await handleWriteMemory(TEST_DIR, {
      key: "overview",
      content: "Shared project notes",
    });
    const result = await handleReadMemory(TEST_DIR, {});
    expect(result.success).toBe(true);
    expect(result.content).toContain("Shared project notes");
  });
});
