// packages/server/src/config.ts
// MCP 클라이언트(Claude Code)로부터 받은 워크스페이스 루트를 기반으로
// 프로젝트 경로를 결정하는 공유 설정 모듈

import { join } from "node:path";
import { fileURLToPath } from "node:url";

// MCP roots/list를 통해 클라이언트가 알려준 프로젝트 루트
// startMcpServer() 완료 후 setProjectRoot()로 초기화됨
let _projectRoot: string | null = null;

export function setProjectRoot(root: string): void {
  _projectRoot = root;
}

// PROJECT_ROOT 우선순위:
// 1. MCP roots/list로 받은 값 (setProjectRoot로 설정)
// 2. RELAY_PROJECT_ROOT env var (수동 override용)
// 3. process.cwd() (fallback — bunx 실행 시 /tmp가 될 수 있음)
export function getProjectRoot(): string {
  return _projectRoot ?? process.env.RELAY_PROJECT_ROOT ?? process.cwd();
}

export function getRelayDir(): string {
  return process.env.RELAY_DIR ?? join(getProjectRoot(), ".relay");
}

// file:// URI → 절대 경로 변환
export function uriToPath(uri: string): string {
  if (uri.startsWith("file://")) {
    return fileURLToPath(uri);
  }
  return uri;
}
