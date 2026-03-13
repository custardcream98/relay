// packages/server/build.ts
// @relay/server npm 패키지 빌드 스크립트
// 실행: bun run build.ts (루트의 build:server 스크립트에서 호출)
import { chmod, cp, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";

const serverRoot = join(import.meta.dir);
const repoRoot = join(serverRoot, "../..");
const outDir = join(serverRoot, "dist");
const dashboardSrc = join(repoRoot, "packages/dashboard/dist");
const dashboardDest = join(outDir, "dashboard");

// 1. 이전 빌드 정리
await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

// 2. 서버 번들링 (bun:sqlite는 Bun 내장이라 externalize)
console.log("📦 서버 번들링 중...");
const result = await Bun.build({
  entrypoints: [join(serverRoot, "src/index.ts")],
  outdir: outDir,
  target: "bun",
  external: ["bun:sqlite"],
  minify: false,
  sourcemap: "none",
});

if (!result.success) {
  for (const msg of result.logs) console.error(msg);
  process.exit(1);
}

// 3. 샤뱅 추가 + 실행 권한 부여
const indexPath = join(outDir, "index.js");
const original = await Bun.file(indexPath).text();
await Bun.write(indexPath, `#!/usr/bin/env bun\n${original}`);
await chmod(indexPath, 0o755);

// 4. 대시보드 정적 파일 복사 (dist/dashboard/)
console.log("🎨 대시보드 파일 복사 중...");
await cp(dashboardSrc, dashboardDest, { recursive: true });

console.log("✅ 빌드 완료 → dist/");
