// packages/server/build.ts
// Build script for relay server
// Usage: bun run build.ts (called from root build:server script)
import { execSync } from "node:child_process";
import { chmod, cp } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const serverRoot = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(serverRoot, "../..");
const outDir = join(serverRoot, "dist");
const indexPath = join(outDir, "index.js");
const dashboardSrc = join(repoRoot, "packages/dashboard/dist");
const dashboardDest = join(outDir, "dashboard");

// 1. Bundle server via tsup (clean + bundle handled by tsup.config.ts)
console.log("📦 Bundling server...");
execSync("bunx tsup", { cwd: serverRoot, stdio: "inherit" });

// 2. Make executable
await chmod(indexPath, 0o755);

// 3. Copy dashboard static files to dist/dashboard/
console.log("🎨 Copying dashboard assets...");
await cp(dashboardSrc, dashboardDest, { recursive: true });

console.log("✅ Build complete → dist/");
