// scripts/install.ts
import { cpSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";

const isGlobal = process.argv.includes("--global");

// HOME 유효성 검사
const HOME = process.env.HOME;
if (isGlobal && !HOME) {
  console.error("[relay] 오류: HOME 환경변수가 설정되지 않았습니다.");
  process.exit(1);
}

const relayRoot = resolve(import.meta.dir, "..");
const skillsSrc = join(relayRoot, "skills");

// 설치 대상 디렉토리 (HOME은 위에서 isGlobal 시 검증함)
const targetDir = isGlobal
  ? join(HOME as string, ".claude", "skills")
  : join(process.cwd(), ".claude", "skills");

console.log(`[relay] ${isGlobal ? "글로벌" : "로컬"} 설치 시작...`);

// 1. 스킬 파일 복사
mkdirSync(targetDir, { recursive: true });
cpSync(skillsSrc, targetDir, { recursive: true });
console.log(`[relay] 스킬 설치 완료: ${targetDir}`);

// 2. MCP 서버 등록
const mcpArgs = isGlobal
  ? ["mcp", "add", "--global", "--transport", "stdio", "relay", "--", "bun", "run", join(relayRoot, "src", "index.ts")]
  : ["mcp", "add", "--transport", "stdio", "relay", "--", "bun", "run", join(relayRoot, "src", "index.ts")];

const mcpResult = Bun.spawnSync(["claude", ...mcpArgs], { stdout: "inherit", stderr: "inherit" });
if (mcpResult.exitCode !== 0) {
  console.warn("[relay] 경고: MCP 서버 등록 실패. claude CLI가 설치되어 있는지 확인하세요.");
} else {
  console.log("[relay] MCP 서버 등록 완료");
}

// 3. .claude/settings.json에 PostToolUse 훅 설정 주입
const settingsDir = isGlobal ? join(HOME as string, ".claude") : join(process.cwd(), ".claude");
const settingsPath = join(settingsDir, "settings.json");

const hookScript = join(relayRoot, "hooks", "post-tool-use.sh");
// Claude Code는 MCP 툴 이름을 "mcp__relay__send_message" 형식으로 전달한다.
// matcher는 정규식 substring search이므로 "mcp__relay__"로 relay 툴만 선별적으로 매칭.
const hookEntry = {
  matcher:
    "mcp__relay__(send_message|create_task|update_task|post_artifact|request_review|submit_review)",
  command: `bash ${hookScript}`,
};

// 기존 settings.json 읽기 (없거나 파싱 실패 시 빈 객체)
let existing: Record<string, unknown> = {};
const settingsFile = Bun.file(settingsPath);
if (await settingsFile.exists()) {
  try {
    existing = JSON.parse(await settingsFile.text());
  } catch {
    console.warn("[relay] 경고: settings.json 파싱 실패 — 빈 설정으로 초기화합니다.");
  }
}

// 기존 PostToolUse 훅 중 relay 것만 교체 (중복 방지)
const existingHooks: { matcher: string; command: string }[] =
  (existing.hooks as { PostToolUse?: { matcher: string; command: string }[] })?.PostToolUse ?? [];
const filtered = existingHooks.filter((h) => !h.command.includes("relay"));

const updated = {
  ...existing,
  hooks: {
    ...(existing.hooks as object | undefined),
    PostToolUse: [...filtered, hookEntry],
  },
};

mkdirSync(settingsDir, { recursive: true });
await Bun.write(settingsPath, JSON.stringify(updated, null, 2));
console.log(`[relay] 훅 설정 완료: ${settingsPath}`);
console.log("[relay] 설치 완료! 프로젝트에서 /relay-init 을 실행하세요.");
