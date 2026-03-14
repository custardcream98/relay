// scripts/sync-plugin-version.js
// Syncs .claude-plugin/plugin.json version with packages/server/package.json.
// Called automatically by changeset as a `version` lifecycle hook.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const serverPkgPath = resolve(root, "packages/server/package.json");
const pluginPath = resolve(root, ".claude-plugin/plugin.json");

const { version } = JSON.parse(readFileSync(serverPkgPath, "utf8"));
const plugin = JSON.parse(readFileSync(pluginPath, "utf8"));

plugin.version = version;
writeFileSync(pluginPath, `${JSON.stringify(plugin, null, 2)}\n`);

console.log(`plugin.json synced → ${version}`);
