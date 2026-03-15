// packages/server/src/tools/hook-runner.test.ts
import { describe, expect, test } from "bun:test";
import { runHook, runHooks } from "./hook-runner";

const CWD = process.cwd();

describe("runHook", () => {
  test("succeeds on zero-exit command", async () => {
    const result = await runHook("echo hello", {}, CWD, 5000);
    expect(result.success).toBe(true);
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain("hello");
  });

  test("fails on non-zero exit", async () => {
    const result = await runHook("exit 1", {}, CWD, 5000);
    expect(result.success).toBe(false);
    expect(result.exitCode).not.toBe(0);
  });

  test("captures combined stdout and stderr", async () => {
    const result = await runHook("echo out; echo err >&2", {}, CWD, 5000);
    expect(result.success).toBe(true);
    expect(result.output).toContain("out");
    expect(result.output).toContain("err");
  });

  test("passes env vars to the command", async () => {
    const result = await runHook("echo $RELAY_AGENT_ID", { RELAY_AGENT_ID: "fe" }, CWD, 5000);
    expect(result.success).toBe(true);
    expect(result.output).toContain("fe");
  });

  test("times out and returns failure", async () => {
    const result = await runHook("sleep 10", {}, CWD, 200);
    expect(result.success).toBe(false);
    expect(result.exitCode).toBeNull();
    expect(result.output).toContain("timed out");
  });

  test("truncates output exceeding MAX_OUTPUT_CHARS", async () => {
    // Generate >2000 chars using Node.js (always available, no python3 dependency)
    const result = await runHook(`node -e "process.stdout.write('x'.repeat(3000))"`, {}, CWD, 5000);
    expect(result.success).toBe(true);
    expect(result.output).toContain("...[truncated]");
    // 2000 chars of content + "\n...[truncated]" (15 chars) = 2015 chars max
    expect(result.output.length).toBeLessThanOrEqual(2015);
  });

  test("injects RELAY_TASK_ID and RELAY_SESSION_ID env vars", async () => {
    const result = await runHook(
      "echo $RELAY_TASK_ID $RELAY_SESSION_ID",
      { RELAY_TASK_ID: "task-123", RELAY_SESSION_ID: "sess-456" },
      CWD,
      5000
    );
    expect(result.success).toBe(true);
    expect(result.output).toContain("task-123");
    expect(result.output).toContain("sess-456");
  });

  test("never rejects on empty command string", async () => {
    // exec("") throws synchronously on some Node.js versions — must not reject
    const result = await runHook("", {}, CWD, 5000);
    expect(result.success).toBe(false);
    expect(result.exitCode).toBeNull();
    expect(result.output).toContain("Failed to spawn hook");
  });
});

describe("runHooks", () => {
  test("returns success when no commands", async () => {
    const result = await runHooks([], {}, CWD, 5000);
    expect(result.success).toBe(true);
    expect(result.exitCode).toBe(0);
  });

  test("runs multiple commands sequentially and succeeds", async () => {
    const result = await runHooks(["echo first", "echo second"], {}, CWD, 5000);
    expect(result.success).toBe(true);
  });

  test("stops on first failure and returns failure", async () => {
    const result = await runHooks(["exit 2", "echo should-not-run"], {}, CWD, 5000);
    expect(result.success).toBe(false);
  });
});
