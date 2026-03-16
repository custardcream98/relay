// packages/server/src/tools/sessions.ts
// Tool for saving and retrieving session summaries as files
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { isValidId } from "../utils/validate.js";

/**
 * Save a session summary to disk.
 * File is written to .relay/sessions/{session_id}/summary.md
 */
export async function handleSaveSessionSummary(
  relayDir: string,
  input: { session_id: string; summary: string }
) {
  // Validate session_id to prevent path traversal
  if (!isValidId(input.session_id)) {
    return { success: false, error: "invalid ID format" };
  }
  try {
    const dir = join(relayDir, "sessions", input.session_id);
    mkdirSync(dir, { recursive: true });

    await writeFile(join(dir, "summary.md"), `${input.summary}\n`);

    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

/**
 * List all sessions sorted by most recent first.
 * Only directories are recognized as sessions.
 */
export async function handleListSessions(relayDir: string) {
  try {
    const sessionsDir = join(relayDir, "sessions");
    if (!existsSync(sessionsDir)) return { success: true, sessions: [] };
    // withFileTypes differentiates files from directories — only directories are sessions
    const sessions = readdirSync(sessionsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      // Lexicographic sort works correctly only when all session IDs use the
      // date-prefixed format "YYYY-MM-DD-HHmmss-XXXX" (the default auto-generated format).
      // Custom RELAY_SESSION_ID values that are not date-prefixed will sort incorrectly.
      .sort()
      .reverse(); // most recent first
    return { success: true, sessions };
  } catch (err) {
    return { success: false, sessions: [], error: String(err) };
  }
}

// Return type for session summary retrieval
type SessionSummaryResult = { success: true; summary: string } | { success: false; error: string };

/**
 * Retrieve the summary.md of a specific session.
 * Returns an error if the session does not exist.
 */
export async function handleGetSessionSummary(
  relayDir: string,
  input: { session_id: string }
): Promise<SessionSummaryResult> {
  // Validate session_id to prevent path traversal
  if (!isValidId(input.session_id)) {
    return { success: false, error: "invalid ID format" };
  }
  try {
    const summaryPath = join(relayDir, "sessions", input.session_id, "summary.md");
    if (!existsSync(summaryPath)) return { success: false, error: "session not found" };
    return { success: true, summary: await readFile(summaryPath, "utf-8") };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}
