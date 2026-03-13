// scripts/install.ts
import { cpSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";

const isGlobal = process.argv.includes("--global");

// Validate HOME for global installs
const HOME = process.env.HOME;
if (isGlobal && !HOME) {
  console.error("[relay] error: HOME environment variable is not set.");
  process.exit(1);
}

const relayRoot = resolve(import.meta.dir, "..");
const skillsSrc = join(relayRoot, "skills");

// Installation target directory (HOME is validated above for global installs)
const targetDir = isGlobal
  ? join(HOME as string, ".claude", "skills")
  : join(process.cwd(), ".claude", "skills");

console.log(`[relay] starting ${isGlobal ? "global" : "local"} install...`);

// 1. Copy skill files
mkdirSync(targetDir, { recursive: true });
cpSync(skillsSrc, targetDir, { recursive: true });
console.log(`[relay] skills installed: ${targetDir}`);

// 2. Register MCP server
// Entry point moved to packages/server/src/index.ts in the monorepo layout
const mcpArgs = isGlobal
  ? [
      "mcp",
      "add",
      "--global",
      "--transport",
      "stdio",
      "relay",
      "--",
      "bun",
      "run",
      join(relayRoot, "packages", "server", "src", "index.ts"),
    ]
  : [
      "mcp",
      "add",
      "--transport",
      "stdio",
      "relay",
      "--",
      "bun",
      "run",
      join(relayRoot, "packages", "server", "src", "index.ts"),
    ];

const mcpResult = Bun.spawnSync(["claude", ...mcpArgs], { stdout: "inherit", stderr: "inherit" });
if (mcpResult.exitCode !== 0) {
  console.warn("[relay] warning: MCP server registration failed. Is the claude CLI installed?");
} else {
  console.log("[relay] MCP server registered");
}

// 3. Inject PostToolUse hook into .claude/settings.json
const settingsDir = isGlobal ? join(HOME as string, ".claude") : join(process.cwd(), ".claude");
const settingsPath = join(settingsDir, "settings.json");

const hookScript = join(relayRoot, "hooks", "post-tool-use.sh");
// Claude Code passes MCP tool names in the format "mcp__relay__send_message".
// The matcher uses substring regex search, so "mcp__relay__" selectively matches relay tools only.
const hookEntry = {
  matcher:
    "mcp__relay__(send_message|create_task|update_task|post_artifact|request_review|submit_review)",
  command: `bash ${hookScript}`,
};

// Read existing settings.json (treat missing or unparseable file as empty object)
let existing: Record<string, unknown> = {};
const settingsFile = Bun.file(settingsPath);
if (await settingsFile.exists()) {
  try {
    existing = JSON.parse(await settingsFile.text());
  } catch {
    console.warn(
      "[relay] warning: settings.json could not be parsed — initializing with empty config."
    );
  }
}

// Replace only the relay hook entry to avoid duplicates
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
console.log(`[relay] hook configured: ${settingsPath}`);
console.log("[relay] install complete! Run /relay-init in your project to get started.");
