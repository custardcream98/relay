// packages/server/src/config.ts
// Shared config module that resolves the project root from the MCP client (Claude Code).

import { isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isValidId } from "./utils/validate.js";

// Project root received via MCP roots/list — set by setProjectRoot() after startMcpServer()
let _projectRoot: string | null = null;

export function setProjectRoot(root: string): void {
  _projectRoot = root;
}

// Priority:
// 1. Value from MCP roots/list (set via setProjectRoot)
// 2. RELAY_PROJECT_ROOT env var (manual override)
// 3. process.cwd() (fallback — may be /tmp when launched via bunx)
export function getProjectRoot(): string {
  return _projectRoot ?? process.env.RELAY_PROJECT_ROOT ?? process.cwd();
}

export function getRelayDir(): string {
  if (process.env.RELAY_DIR) {
    const dir = resolve(process.env.RELAY_DIR);
    // OPERATOR TRUST: RELAY_DIR is set by the process owner, same trust level as working directory.
    // Still sanity-check that resolve() produced an absolute path — guards against exotic environments.
    if (!isAbsolute(dir)) throw new Error(`RELAY_DIR resolved to non-absolute path: ${dir}`);
    return dir;
  }
  return join(getProjectRoot(), ".relay");
}

/**
 * Returns the relay instance ID, or undefined for the default (single) instance.
 * Set via RELAY_INSTANCE env var or --instance CLI arg.
 */
export function getInstanceId(): string | undefined {
  return process.env.RELAY_INSTANCE;
}

// Actual dashboard port — set by index.ts after port resolution.
// Set to null when the dashboard failed to bind (e.g. EADDRINUSE).
let _port: number | null = null;

export function setPort(port: number | null): void {
  _port = port;
}

export function getPort(): number | null {
  return _port;
}

// Convert a file:// URI to an absolute path
export function uriToPath(uri: string): string {
  if (uri.startsWith("file://")) {
    return fileURLToPath(uri);
  }
  return uri;
}

// Session ID singleton — one ID per server process; all modules share the same ID
let _sessionId: string | null = null;

/**
 * Returns the session ID for the current server process.
 * Priority:
 * 1. RELAY_SESSION_ID env var (explicit override)
 * 2. Auto-generated on first call (YYYY-MM-DD-HHmmss format, all UTC)
 *
 * Auto-generation ensures a new session starts on each server restart,
 * preventing stale data from bleeding into the live dashboard view.
 */
export function getSessionId(): string {
  if (_sessionId !== null) return _sessionId;
  if (process.env.RELAY_SESSION_ID) {
    if (!isValidId(process.env.RELAY_SESSION_ID)) {
      console.error(
        "[relay] invalid RELAY_SESSION_ID value; use alphanumeric, hyphen, underscore only"
      );
      process.exit(1);
    }
    _sessionId = process.env.RELAY_SESSION_ID;
    return _sessionId;
  }
  // Auto-generate in YYYY-MM-DD-HHmmss-XXXX format using UTC consistently.
  // (toISOString() returns UTC — use getUTC* for H/M/S to match the UTC date)
  // A 4-char random hex suffix prevents collisions when two server processes start
  // within the same UTC second (e.g. rapid restarts or parallel CI jobs).
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const hh = String(now.getUTCHours()).padStart(2, "0");
  const mm = String(now.getUTCMinutes()).padStart(2, "0");
  const ss = String(now.getUTCSeconds()).padStart(2, "0");
  const rand = Math.floor(Math.random() * 0x10000)
    .toString(16)
    .padStart(4, "0");
  _sessionId = `${date}-${hh}${mm}${ss}-${rand}`;
  return _sessionId;
}

/**
 * Override the session ID for the current server process.
 * Called by the start_session MCP tool when a new /relay:relay session begins.
 * This allows multiple sequential relay sessions within the same server process
 * to store data under distinct session IDs.
 */
export function setSessionId(id: string): void {
  // Defense-in-depth: validate even though the start_session MCP tool already validates via Zod.
  // Prevents unexpected values from slipping in during tests or direct programmatic calls.
  if (!isValidId(id)) {
    throw new Error(`setSessionId: invalid session ID format: "${id}"`);
  }
  _sessionId = id;
}

/**
 * Reset the session ID singleton back to null so getSessionId() will
 * auto-generate a fresh timestamp-based ID on next call.
 * @internal Test-only — do not call from production code.
 */
export function _resetSessionId(): void {
  _sessionId = null;
}

/**
 * Reset the project root singleton back to null so getProjectRoot() will
 * fall back to env vars / cwd on next call.
 * @internal Test-only — do not call from production code.
 */
export function _resetProjectRoot(): void {
  _projectRoot = null;
}
