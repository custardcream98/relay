// packages/server/src/tools/hook-runner.ts
// Git-hook style shell command executor for before_task / after_task hooks.
// Never rejects — always resolves with a HookResult.

import { exec } from "node:child_process";

const MAX_OUTPUT_CHARS = 2000;
const DEFAULT_BEFORE_TIMEOUT_MS = 30_000;
const DEFAULT_AFTER_TIMEOUT_MS = 120_000;

export interface HookResult {
  success: boolean;
  exitCode: number | null;
  /** Combined stdout + stderr, capped at MAX_OUTPUT_CHARS. */
  output: string;
}

/**
 * Run a single shell command and return a HookResult.
 * - Never rejects.
 * - On timeout: sends SIGTERM, then SIGKILL after 5s.
 * - Combined stdout + stderr is capped at MAX_OUTPUT_CHARS.
 * - Env vars from `env` are merged on top of the current process environment.
 */
export function runHook(
  command: string,
  env: Record<string, string>,
  cwd: string,
  timeoutMs: number
): Promise<HookResult> {
  return new Promise((resolve) => {
    let settled = false;
    const settle = (result: HookResult) => {
      if (!settled) {
        settled = true;
        resolve(result);
      }
    };

    const child = exec(
      command,
      { cwd, env: { ...process.env, ...env }, maxBuffer: 10 * 1024 * 1024 },
      (error, stdout, stderr) => {
        clearTimeout(timer);
        const combined = `${stdout}${stderr}`.trim();
        const output =
          combined.length > MAX_OUTPUT_CHARS
            ? `${combined.slice(0, MAX_OUTPUT_CHARS)}\n...[truncated]`
            : combined;
        settle({
          success: !error,
          exitCode: error
            ? (((error as NodeJS.ErrnoException).code as unknown as number) ?? null)
            : 0,
          output,
        });
      }
    );

    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      setTimeout(() => {
        try {
          child.kill("SIGKILL");
        } catch {
          // Process may already be gone
        }
      }, 5000);
      settle({
        success: false,
        exitCode: null,
        output: `Hook timed out after ${timeoutMs}ms (command: ${command})`,
      });
    }, timeoutMs);
  });
}

/**
 * Run an array of shell commands sequentially.
 * Stops and returns failure on the first non-zero exit.
 * Returns { success: true, exitCode: 0, output: "" } if no commands are provided.
 */
export async function runHooks(
  commands: string[],
  env: Record<string, string>,
  cwd: string,
  timeoutMs: number
): Promise<HookResult> {
  for (const command of commands) {
    const result = await runHook(command, env, cwd, timeoutMs);
    if (!result.success) return result;
  }
  return { success: true, exitCode: 0, output: "" };
}

export { DEFAULT_BEFORE_TIMEOUT_MS, DEFAULT_AFTER_TIMEOUT_MS };
