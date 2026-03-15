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
