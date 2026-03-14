// scripts/sync-plugin-version.js
// Syncs .claude-plugin/plugin.json and .claude-plugin/marketplace.json version
// with packages/server/package.json.
// Called automatically by changeset as a `version` lifecycle hook.
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const serverPkgPath = resolve(root, "packages/server/package.json");
const pluginPath = resolve(root, ".claude-plugin/plugin.json");
const marketplacePath = resolve(root, ".claude-plugin/marketplace.json");

const { version } = JSON.parse(readFileSync(serverPkgPath, "utf8"));

// Sync plugin.json
const plugin = JSON.parse(readFileSync(pluginPath, "utf8"));
plugin.version = version;
writeFileSync(pluginPath, `${JSON.stringify(plugin, null, 2)}\n`);

// Sync marketplace.json (nested under plugins[].version)
const marketplace = JSON.parse(readFileSync(marketplacePath, "utf8"));
for (const p of marketplace.plugins ?? []) {
  p.version = version;
}
writeFileSync(marketplacePath, `${JSON.stringify(marketplace, null, 2)}\n`);

// Reformat with Biome so the pre-commit hook doesn't reject the output
execSync(`bunx biome format --write "${pluginPath}" "${marketplacePath}"`, { stdio: "ignore" });

console.log(`plugin.json + marketplace.json synced → ${version}`);
