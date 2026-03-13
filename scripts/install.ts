// scripts/install.ts
// relay 로컬/글로벌 설치 스크립트
// 사용: bun run scripts/install.ts [--global]

import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const isGlobal = process.argv.includes("--global");
const scope = isGlobal ? "global" : "local";
const mcpScope = isGlobal ? "user" : "local";

const ROOT = import.meta.dir.replace(/\/scripts$/, "");
const HOME = process.env.HOME ?? process.env.USERPROFILE ?? "";

// 스킬 설치 경로
const skillsDest = isGlobal
  ? join(HOME, ".claude", "skills", "relay")
  : join(ROOT, ".claude", "skills", "relay");

// MCP 서버 바이너리 경로 (빌드 결과물)
const serverBin = join(ROOT, "packages", "server", "dist", "index.js");

// ─── Step 1: 빌드 ────────────────────────────────────────────────────────────
console.log("▶ Building...");
const build = Bun.spawnSync(["bun", "run", "build:release"], {
  cwd: ROOT,
  stdio: ["inherit", "inherit", "inherit"],
});
if (build.exitCode !== 0) {
  console.error("✗ Build failed");
  process.exit(1);
}

// ─── Step 2: 스킬 복사 ────────────────────────────────────────────────────────
console.log(`▶ Installing skills → ${skillsDest}`);
if (existsSync(skillsDest)) {
  rmSync(skillsDest, { recursive: true });
}
mkdirSync(skillsDest, { recursive: true });
cpSync(join(ROOT, "skills"), skillsDest, { recursive: true });

// ─── Step 3: MCP 등록 ─────────────────────────────────────────────────────────
console.log(`▶ Registering MCP server (scope: ${mcpScope})...`);

// 기존 등록 제거 후 재등록 (에러 무시)
Bun.spawnSync(["claude", "mcp", "remove", "relay", "--scope", mcpScope], {
  stdio: ["inherit", "inherit", "inherit"],
});

const mcp = Bun.spawnSync(
  ["claude", "mcp", "add", "relay", "--scope", mcpScope, "--", "bun", "run", serverBin],
  { stdio: ["inherit", "inherit", "inherit"] }
);
if (mcp.exitCode !== 0) {
  console.error("✗ MCP registration failed");
  process.exit(1);
}

console.log(`\n✓ relay installed (${scope})`);
console.log(`  Skills: ${skillsDest}`);
console.log(`  Server: bun run ${serverBin}`);
console.log(`\nRun /reload-plugins in Claude Code to activate.`);
