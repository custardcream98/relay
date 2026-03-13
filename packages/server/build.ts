// packages/server/build.ts
// Build script for @custardcream/relay npm package
// Usage: bun run build.ts (called from root build:server script)

import { chmod, cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const serverRoot = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(serverRoot, "../..");
const outDir = join(serverRoot, "dist");
const indexPath = join(outDir, "index.js");
const dashboardSrc = join(repoRoot, "packages/dashboard/dist");
const dashboardDest = join(outDir, "dashboard");

// 1. Clean previous build
await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

// 2. Bundle server (better-sqlite3 and ws are native/CJS externals)
console.log("📦 Bundling server...");
await build({
  entryPoints: [join(serverRoot, "src/index.ts")],
  outfile: indexPath,
  bundle: true,
  platform: "node",
  format: "esm",
  external: ["better-sqlite3", "ws"],
  loader: { ".yml": "text" }, // bundle .yml files as strings (replaces Bun's with { type: "text" } import attribute)
  minify: false,
  sourcemap: false,
});

// 3. Add shebang + make executable
const original = await readFile(indexPath, "utf-8");
await writeFile(indexPath, `#!/usr/bin/env node\n${original}`);
await chmod(indexPath, 0o755);

// 4. Copy dashboard static files to dist/dashboard/
console.log("🎨 Copying dashboard assets...");
await cp(dashboardSrc, dashboardDest, { recursive: true });

console.log("✅ Build complete → dist/");
