import type { ArtifactRow } from "../../store";
import {
  getAllArtifacts as storeGetAllArtifacts,
  getArtifactByName as storeGetArtifactByName,
  insertArtifact as storeInsertArtifact,
} from "../../store";
import type { SqliteDatabase } from "../types";

export type { ArtifactRow } from "../../store";

// Insert an artifact into the in-memory store
export function insertArtifact(
  _db: SqliteDatabase,
  artifact: Omit<ArtifactRow, "created_at">
): void {
  storeInsertArtifact(artifact);
}

// Look up an artifact by name within a session (most recent match)
export function getArtifactByName(
  _db: SqliteDatabase,
  sessionId: string,
  name: string
): ArtifactRow | null {
  return storeGetArtifactByName(sessionId, name);
}

// Fetch all artifacts in a session
export function getAllArtifacts(_db: SqliteDatabase, sessionId: string): ArtifactRow[] {
  return storeGetAllArtifacts(sessionId);
}
