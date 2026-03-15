// packages/server/src/tools/hook-runner.ts
// Git-hook style shell command executor for before_task / after_task hooks.
// Never rejects — always resolves with a HookResult.

import type { ChildProcess } from "node:child_process";
import { exec } from "node:child_process";

const MAX_OUTPUT_CHARS = 2000;
export const DEFAULT_BEFORE_TIMEOUT_MS = 30_000;
export const DEFAULT_AFTER_TIMEOUT_MS = 120_000;

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

    // Guard against exec() throwing synchronously (e.g. empty command string on some platforms).
    // Without this, a sync throw inside the Promise constructor propagates as a rejection,
    // violating the "never rejects" contract.
    let child: ChildProcess;
    try {
      child = exec(
        command,
        { cwd, env: { ...process.env, ...env }, maxBuffer: 10 * 1024 * 1024 },
        (error, stdout, stderr) => {
          clearTimeout(timer);
          const combined = `${stdout}${stderr}`.trim();
          const output =
            combined.length > MAX_OUTPUT_CHARS
              ? `${combined.slice(0, MAX_OUTPUT_CHARS)}\n...[truncated]`
              : combined;
          // error.code is a number (exit code) for non-zero exits, but a POSIX string
          // (e.g. "ENOENT") for spawn/syscall failures. Only use it when it is numeric.
          // error is null on success, so the code access is guarded by the outer ternary.
          settle({
            success: !error,
            exitCode: error
              ? (() => {
                  const code = (error as NodeJS.ErrnoException).code;
                  return typeof code === "number" ? code : null;
                })()
              : 0,
            output,
          });
        }
      );
    } catch (err) {
      settle({ success: false, exitCode: null, output: `Failed to spawn hook: ${String(err)}` });
      return;
    }

    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      // SIGKILL escalation: only kill if the process hasn't already exited
      // (child.exitCode is set when the process exits, preventing a stale kill on a recycled PID)
      setTimeout(() => {
        try {
          if (child.exitCode === null) child.kill("SIGKILL");
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
