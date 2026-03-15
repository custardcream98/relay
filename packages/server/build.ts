// packages/server/build.ts
// Build script for @custardcream/relay npm package
// Usage: bun run build.ts (called from root build:server script)

import { chmod, cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const serverRoot = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(serverRoot, "../..");
const outDir = join(serverRoot, "dist");
const indexPath = join(outDir, "index.js");
const dashboardSrc = join(repoRoot, "packages/dashboard/dist");
const dashboardDest = join(outDir, "dashboard");

// 1. Clean previous build
await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

// 2. Bundle server (target: bun — bun:sqlite is built into Bun, no native addon required)
console.log("📦 Bundling server...");
const result = await Bun.build({
  entrypoints: [join(serverRoot, "src/index.ts")],
  outdir: outDir,
  target: "bun",
  minify: false,
  sourcemap: "none",
});

if (!result.success) {
  for (const msg of result.logs) console.error(msg);
  process.exit(1);
}

// 3. Add shebang + make executable
const original = await readFile(indexPath, "utf-8");
await writeFile(indexPath, `#!/usr/bin/env bun\n${original}`);
await chmod(indexPath, 0o755);

// 4. Copy dashboard static files to dist/dashboard/
console.log("🎨 Copying dashboard assets...");
await cp(dashboardSrc, dashboardDest, { recursive: true });

console.log("✅ Build complete → dist/");
