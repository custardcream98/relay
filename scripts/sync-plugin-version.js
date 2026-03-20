#!/usr/bin/env node
// scripts/sync-plugin-version.js
// One-touch version bump: bumps plugin version, rebuilds dist, and commits.
//
// Usage:
//   bun run bump patch   # 0.18.2 → 0.18.3
//   bun run bump minor   # 0.18.2 → 0.19.0
//   bun run bump major   # 0.18.2 → 1.0.0
//
// Source of truth: .claude-plugin/plugin.json
// Syncs to:        .claude-plugin/marketplace.json
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pluginPath = resolve(root, ".claude-plugin/plugin.json");
const marketplacePath = resolve(root, ".claude-plugin/marketplace.json");

const bump = process.argv[2];
if (!bump || !["patch", "minor", "major"].includes(bump)) {
  console.error("Usage: bun run bump <patch|minor|major>");
  process.exit(1);
}

// Read current version
const plugin = JSON.parse(readFileSync(pluginPath, "utf8"));
const [major, minor, patch] = plugin.version.split(".").map(Number);

// Bump
const next =
  bump === "major"
    ? `${major + 1}.0.0`
    : bump === "minor"
      ? `${major}.${minor + 1}.0`
      : `${major}.${minor}.${patch + 1}`;

// Write plugin.json
plugin.version = next;
writeFileSync(pluginPath, `${JSON.stringify(plugin, null, 2)}\n`);

// Write marketplace.json
const marketplace = JSON.parse(readFileSync(marketplacePath, "utf8"));
for (const p of marketplace.plugins ?? []) {
  p.version = next;
}
writeFileSync(marketplacePath, `${JSON.stringify(marketplace, null, 2)}\n`);

// Format
execSync(`bunx prettier --write "${pluginPath}" "${marketplacePath}"`, {
  stdio: "ignore",
});

console.log(`v${next}`);

// Build
console.log("Building...");
execSync("bun run build:release", { cwd: root, stdio: "inherit" });

// Commit + tag (--no-verify: dist files trigger slow lint-staged on bundled JS)
execSync(
  `git add .claude-plugin/plugin.json .claude-plugin/marketplace.json packages/server/dist/`,
  { cwd: root }
);
execSync(`git commit --no-verify -m "chore: version up v${next}"`, {
  cwd: root,
  stdio: "inherit",
});
execSync(`git tag v${next}`, { cwd: root });

// Push + GitHub Release
execSync(`git push && git push --tags`, { cwd: root, stdio: "inherit" });
execSync(`gh release create v${next} --generate-notes`, {
  cwd: root,
  stdio: "inherit",
});

console.log(`Done — v${next} released.`);
