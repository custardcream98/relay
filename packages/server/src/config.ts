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

// Convert a file:// URI to an absolute path
export function uriToPath(uri: string): string {
  if (uri.startsWith("file://")) {
    return fileURLToPath(uri);
  }
  return uri;
}
