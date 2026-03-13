import type { SqliteDatabase } from "../types";

export interface ArtifactRow {
  id: string;
  session_id: string;
  name: string;
  type: string;
  content: string;
  created_by: string;
  task_id: string | null;
  created_at: number;
}

// Insert an artifact into the DB
export function insertArtifact(
  db: SqliteDatabase,
  artifact: Omit<ArtifactRow, "created_at">
): void {
  db.prepare(`
    INSERT INTO artifacts (id, session_id, name, type, content, created_by, task_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    artifact.id,
    artifact.session_id,
    artifact.name,
    artifact.type,
    artifact.content,
    artifact.created_by,
    artifact.task_id
  );
}

// Look up an artifact by name within a session (most recent match)
export function getArtifactByName(
  db: SqliteDatabase,
  sessionId: string,
  name: string
): ArtifactRow | null {
  return (
    (db
      .prepare(
        "SELECT * FROM artifacts WHERE session_id = ? AND name = ? ORDER BY created_at DESC LIMIT 1"
      )
      .get(sessionId, name) as ArtifactRow | undefined) ?? null
  );
}

// Fetch all artifacts in a session
export function getAllArtifacts(db: SqliteDatabase, sessionId: string): ArtifactRow[] {
  return db
    .prepare("SELECT * FROM artifacts WHERE session_id = ? ORDER BY created_at ASC")
    .all(sessionId) as ArtifactRow[];
}
