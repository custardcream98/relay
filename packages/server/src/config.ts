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

// Actual dashboard port — set by index.ts after port resolution
let _port: number | null = null;

export function setPort(port: number): void {
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

// 서버 프로세스당 한 번 생성되는 세션 ID — 모든 모듈이 동일한 ID를 사용하도록 싱글턴으로 관리
let _sessionId: string | null = null;

/**
 * 현재 서버 프로세스의 세션 ID를 반환한다.
 * Priority:
 * 1. RELAY_SESSION_ID env var (명시적 설정)
 * 2. 서버 시작 시 자동 생성 (YYYY-MM-DD-HHmmss 형식)
 *
 * 자동 생성 덕분에 매번 서버를 새로 시작할 때마다 새 세션이 시작되어
 * 대시보드 태스크 보드에 이전 세션 데이터가 섞이지 않는다.
 */
export function getSessionId(): string {
  if (_sessionId) return _sessionId;
  if (process.env.RELAY_SESSION_ID) {
    _sessionId = process.env.RELAY_SESSION_ID;
    return _sessionId;
  }
  // YYYY-MM-DD-HHmmss 형식으로 자동 생성
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  _sessionId = `${date}-${hh}${mm}${ss}`;
  return _sessionId;
}
