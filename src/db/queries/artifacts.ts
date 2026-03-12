import type { Database } from "bun:sqlite";

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

// 아티팩트를 DB에 저장한다
export function insertArtifact(
  db: Database,
  artifact: Omit<ArtifactRow, "created_at">
): void {
  db.query(`
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

// 세션 내 아티팩트를 이름으로 조회한다 (가장 최신)
export function getArtifactByName(
  db: Database,
  sessionId: string,
  name: string
): ArtifactRow | null {
  return (
    db.query<ArtifactRow, [string, string]>(
      "SELECT * FROM artifacts WHERE session_id = ? AND name = ? ORDER BY created_at DESC LIMIT 1"
    ).get(sessionId, name) ?? null
  );
}

// 세션 내 모든 아티팩트를 조회한다
export function getAllArtifacts(
  db: Database,
  sessionId: string
): ArtifactRow[] {
  return db.query<ArtifactRow, [string]>(
    "SELECT * FROM artifacts WHERE session_id = ? ORDER BY created_at ASC"
  ).all(sessionId);
}
