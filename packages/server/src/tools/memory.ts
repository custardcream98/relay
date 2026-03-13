// packages/server/src/tools/memory.ts
// Tool for reading and writing agent memory as Markdown files
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

// Validate agent_id to prevent path traversal attacks
function isValidId(id: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(id);
}

// Validate memory section key — newlines would corrupt section headers
function isValidMemoryKey(key: string): boolean {
  return key.length > 0 && !key.includes("\n") && !key.includes("\r");
}

// Path to an agent's personal memory file
function agentMemoryPath(relayDir: string, agentId: string): string {
  return join(relayDir, "memory", "agents", `${agentId}.md`);
}

// Path to the shared project memory file
function projectMemoryPath(relayDir: string): string {
  return join(relayDir, "memory", "project.md");
}

// Path to the shared team retrospectives file
function lessonsMemoryPath(relayDir: string): string {
  return join(relayDir, "memory", "lessons.md");
}

// Ensure the memory/agents directory exists
function ensureDir(relayDir: string): void {
  mkdirSync(join(relayDir, "memory", "agents"), { recursive: true });
}

/**
 * Read memory.
 * Without agent_id: returns project.md + lessons.md combined.
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
        ? await Bun.file(projectMemoryPath(relayDir)).text()
        : null;
      const lessons = existsSync(lessonsMemoryPath(relayDir))
        ? await Bun.file(lessonsMemoryPath(relayDir)).text()
        : null;
      const content =
        [project, lessons].filter((s): s is string => s !== null).join("\n\n---\n\n") || null;
      return { success: true, content };
    }

    const path = agentMemoryPath(relayDir, input.agent_id);
    if (!existsSync(path)) return { success: true, content: null };
    return { success: true, content: await Bun.file(path).text() };
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

    const existing = existsSync(path) ? await Bun.file(path).text() : "";

    // Split into lines to accurately locate section boundaries (avoids regex metacharacter issues)
    const lines = existing.split("\n");
    const headerLine = `## ${input.key}`;
    const startIdx = lines.indexOf(headerLine);

    if (startIdx === -1) {
      // Section absent — append at end
      const suffix = `${existing.length > 0 ? "\n" : ""}## ${input.key}\n\n${input.content}`;
      await Bun.write(path, `${(existing.trimEnd() + suffix).trimEnd()}\n`);
    } else {
      // Replace up to the next ## header or end of file
      let endIdx = lines.findIndex((l, i) => i > startIdx && l.startsWith("## "));
      if (endIdx === -1) endIdx = lines.length;
      const before = lines.slice(0, startIdx);
      const after = lines.slice(endIdx);
      const newSection = [`## ${input.key}`, "", input.content];
      const merged = [...before, ...newSection, ...after].join("\n");
      await Bun.write(path, `${merged.trimEnd()}\n`);
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

/**
 * Append to memory.
 * Without agent_id: appends to the shared lessons.md.
 * With agent_id: appends to the agent's personal file with a datestamp.
 */
export async function handleAppendMemory(
  relayDir: string,
  input: { agent_id?: string; content: string }
) {
  // Validate agent_id to prevent path traversal
  if (input.agent_id !== undefined && !isValidId(input.agent_id)) {
    return { success: false, error: "invalid ID format" };
  }
  try {
    ensureDir(relayDir);
    // Without agent_id: append to the shared lessons.md (project.md is write_memory-only)
    const path = input.agent_id
      ? agentMemoryPath(relayDir, input.agent_id)
      : lessonsMemoryPath(relayDir);

    const timestamp = new Date().toISOString().split("T")[0];
    const entry = `\n---\n_${timestamp}_\n\n${input.content}\n`;

    const existing = existsSync(path) ? await Bun.file(path).text() : "";
    await Bun.write(path, existing + entry);
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}
