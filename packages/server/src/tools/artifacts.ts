import { getArtifactByName, insertArtifact } from "../db/queries/artifacts";
import type { SqliteDatabase } from "../db/types";

export async function handlePostArtifact(
  db: SqliteDatabase,
  sessionId: string,
  input: {
    agent_id: string;
    name: string;
    type: string;
    content: string;
    task_id?: string;
  }
) {
  const id = crypto.randomUUID();
  insertArtifact(db, {
    id,
    session_id: sessionId,
    name: input.name,
    type: input.type,
    content: input.content,
    created_by: input.agent_id,
    task_id: input.task_id ?? null,
  });
  return { success: true, artifact_id: id };
}

export async function handleGetArtifact(
  db: SqliteDatabase,
  sessionId: string,
  input: { agent_id: string; name: string }
) {
  const artifact = getArtifactByName(db, sessionId, input.name);
  if (!artifact) {
    return {
      success: false,
      artifact: null,
      error: "artifact not found",
    };
  }
  return { success: true, artifact };
}
