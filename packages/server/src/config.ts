// packages/server/src/config.ts
// Shared config module that resolves the project root from the MCP client (Claude Code).

import { join } from "node:path";
import { fileURLToPath } from "node:url";

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
  return process.env.RELAY_DIR ?? join(getProjectRoot(), ".relay");
}

/**
 * Returns the relay instance ID, or undefined for the default (single) instance.
 * Set via RELAY_INSTANCE env var or --session CLI arg.
 */
export function getInstanceId(): string | undefined {
  return process.env.RELAY_INSTANCE ?? undefined;
}

/**
 * Returns the SQLite DB file path for this instance.
 * Priority:
 * 1. RELAY_DB_PATH env var (explicit override)
 * 2. .relay/relay-{instance}.db when RELAY_INSTANCE is set
 * 3. .relay/relay.db (default)
 */
export function getDbPath(): string {
  if (process.env.RELAY_DB_PATH) return process.env.RELAY_DB_PATH;
  const instance = getInstanceId();
  if (instance) return join(getRelayDir(), `relay-${instance}.db`);
  return join(getRelayDir(), "relay.db");
}

// Convert a file:// URI to an absolute path
export function uriToPath(uri: string): string {
  if (uri.startsWith("file://")) {
    return fileURLToPath(uri);
  }
  return uri;
}
