// scripts/install.ts
import { cpSync, mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

const isGlobal = process.argv.includes("--global");
const relayRoot = resolve(import.meta.dir, "..");
const skillsSrc = join(relayRoot, "skills");

// 설치 대상 디렉토리
const targetDir = isGlobal
  ? join(process.env.HOME!, ".claude", "skills")
  : join(process.cwd(), ".claude", "skills");

console.log(`[relay] ${isGlobal ? "글로벌" : "로컬"} 설치 시작...`);

// 1. 스킬 파일 복사
mkdirSync(targetDir, { recursive: true });
cpSync(skillsSrc, targetDir, { recursive: true });
console.log(`[relay] 스킬 설치 완료: ${targetDir}`);

// 2. MCP 서버 등록 (Bun 내장 API 사용)
const mcpArgs = isGlobal
  ? ["mcp", "add", "--global", "relay", "--", "bun", "run", join(relayRoot, "src", "index.ts")]
  : ["mcp", "add", "relay", "--", "bun", "run", join(relayRoot, "src", "index.ts")];

Bun.spawnSync(["claude", ...mcpArgs], { stdout: "inherit", stderr: "inherit" });
console.log("[relay] MCP 서버 등록 완료");

// 3. .claude/settings.json에 PostToolUse 훅 설정 주입
const settingsDir = isGlobal
  ? join(process.env.HOME!, ".claude")
  : join(process.cwd(), ".claude");
const settingsPath = join(settingsDir, "settings.json");

const hookScript = join(relayRoot, "hooks", "post-tool-use.sh");
// Claude Code는 MCP 툴 이름을 "mcp__relay__send_message" 형식으로 전달한다.
// matcher는 정규식 substring search이므로 "mcp__relay__"로 relay 툴만 선별적으로 매칭.
const hookEntry = {
  matcher: "mcp__relay__(send_message|create_task|update_task|post_artifact|request_review|submit_review)",
  command: `bash ${hookScript}`,
};

const existing = existsSync(settingsPath)
  ? JSON.parse(readFileSync(settingsPath, "utf-8"))
  : {};

// 기존 PostToolUse 훅 중 relay 것만 교체 (중복 방지)
const existingHooks: { matcher: string; command: string }[] =
  existing.hooks?.PostToolUse ?? [];
const filtered = existingHooks.filter((h) => !h.command.includes("relay"));

const updated = {
  ...existing,
  hooks: {
    ...existing.hooks,
    PostToolUse: [...filtered, hookEntry],
  },
};

mkdirSync(settingsDir, { recursive: true });
writeFileSync(settingsPath, JSON.stringify(updated, null, 2));
console.log(`[relay] 훅 설정 완료: ${settingsPath}`);
console.log("[relay] 설치 완료! 프로젝트에서 /relay-init 을 실행하세요.");
