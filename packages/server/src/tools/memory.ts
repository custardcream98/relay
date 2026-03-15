// packages/server/src/tools/memory.ts
// Tool for reading and writing agent memory as Markdown files
import { existsSync, mkdirSync } from "node:fs";
import { appendFile, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";

// Validate agent_id to prevent path traversal attacks
function isValidId(id: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(id);
}

// Validate memory section key — newlines would corrupt section headers; 256-char max
function isValidMemoryKey(key: string): boolean {
  return key.length > 0 && key.length <= 256 && !key.includes("\n") && !key.includes("\r");
}

// Path to an agent's personal memory file
function agentMemoryPath(relayDir: string, agentId: string): string {
  return join(relayDir, "memory", "agents", `${agentId}.md`);
}

// Path to the shared project memory file
function projectMemoryPath(relayDir: string): string {
  return join(relayDir, "memory", "project.md");
}

// Ensure the memory/agents directory exists
function ensureDir(relayDir: string): void {
  mkdirSync(join(relayDir, "memory", "agents"), { recursive: true });
}

/**
 * Read memory.
 * Without agent_id: returns project.md only.
 * With agent_id: returns that agent's file (null if absent).
 */
export async function handleReadMemory(relayDir: string, input: { agent_id?: string }) {
  // Validate agent_id to prevent path traversal
  if (input.agent_id !== undefined && !isValidId(input.agent_id)) {
    return { success: false, content: null, error: "invalid ID format" };
  }
  try {
    if (!input.agent_id) {
      const project = existsSync(projectMemoryPath(relayDir))
        ? await readFile(projectMemoryPath(relayDir), "utf-8")
        : null;
      return { success: true, content: project };
    }

    const path = agentMemoryPath(relayDir, input.agent_id);
    if (!existsSync(path)) return { success: true, content: null };
    return { success: true, content: await readFile(path, "utf-8") };
  } catch (err) {
    return { success: false, content: null, error: String(err) };
  }
}

/**
 * Write (overwrite) a memory section.
 * Without agent_id: writes to project.md.
 * With agent_id: writes to the agent's personal file.
 * Replaces the section if the key already exists; appends otherwise.
 */
export async function handleWriteMemory(
  relayDir: string,
  input: { agent_id?: string; key: string; content: string }
) {
  // Validate agent_id to prevent path traversal
  if (input.agent_id !== undefined && !isValidId(input.agent_id)) {
    return { success: false, error: "invalid ID format" };
  }
  // Validate key — newlines could corrupt section headers
  if (!isValidMemoryKey(input.key)) {
    return { success: false, error: "invalid key format (newlines not allowed)" };
  }
  try {
    ensureDir(relayDir);
    const path = input.agent_id
      ? agentMemoryPath(relayDir, input.agent_id)
      : projectMemoryPath(relayDir);

    const existing = existsSync(path) ? await readFile(path, "utf-8") : "";

    // Split into lines to accurately locate section boundaries (avoids regex metacharacter issues)
    const lines = existing.split("\n");
    const headerLine = `## ${input.key}`;
    const startIdx = lines.indexOf(headerLine);

    let newContent: string;
    if (startIdx === -1) {
      // Section absent — append at end
      const suffix = `${existing.length > 0 ? "\n" : ""}## ${input.key}\n\n${input.content}`;
      newContent = `${(existing.trimEnd() + suffix).trimEnd()}\n`;
    } else {
      // Replace up to the next ## header or end of file
      let endIdx = lines.findIndex((l, i) => i > startIdx && l.startsWith("## "));
      if (endIdx === -1) endIdx = lines.length;
      const before = lines.slice(0, startIdx);
      const after = lines.slice(endIdx);
      const newSection = [`## ${input.key}`, "", input.content];
      const merged = [...before, ...newSection, ...after].join("\n");
      newContent = `${merged.trimEnd()}\n`;
    }

    // Write atomically: write to a temp file then rename to avoid partial-write corruption
    const tmpPath = `${path}.tmp`;
    await writeFile(tmpPath, newContent);
    try {
      await rename(tmpPath, path);
    } catch (err) {
      // Clean up the temp file if rename fails to avoid leaving orphaned .tmp files
      try {
        await unlink(tmpPath);
      } catch {
        // Ignore cleanup failure — best-effort only
      }
      throw err;
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

/**
 * Append to an agent's personal memory file with a datestamp.
 * agent_id is required — use save_session_summary for session retrospectives.
 */
export async function handleAppendMemory(
  relayDir: string,
  input: { agent_id: string; content: string }
) {
  // Runtime guard for direct callers: Zod enforces agent_id at the MCP layer,
  // but defensive check here prevents writing to agents/undefined.md if called directly.
  if ((input.agent_id as string | undefined) === undefined) {
    return {
      success: false,
      error:
        "append_memory without agent_id is no longer supported. " +
        "Use save_session_summary to persist session retrospectives.",
    };
  }
  // Validate agent_id to prevent path traversal
  if (!isValidId(input.agent_id)) {
    return { success: false, error: "invalid ID format" };
  }
  try {
    ensureDir(relayDir);
    const path = agentMemoryPath(relayDir, input.agent_id);
    const timestamp = new Date().toISOString().split("T")[0];
    const entry = `\n---\n_${timestamp}_\n\n${input.content}\n`;

    // Use appendFile for atomic append — avoids read-then-write race when multiple agents
    // call append_memory concurrently at session end
    await appendFile(path, entry);
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}
