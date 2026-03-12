import type { Database } from "bun:sqlite";
import {
  insertArtifact,
  getArtifactByName,
  type ArtifactRow,
} from "../db/queries/artifacts";
import { randomUUID } from "crypto";

export async function handlePostArtifact(
  db: Database,
  sessionId: string,
  input: {
    agent_id: string;
    name: string;
    type: string;
    content: string;
    task_id?: string;
  }
) {
  const id = randomUUID();
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
  db: Database,
  sessionId: string,
  input: { agent_id: string; name: string }
) {
  const artifact = getArtifactByName(db, sessionId, input.name);
  if (!artifact) {
    return {
      success: false,
      artifact: null,
      error: "아티팩트를 찾을 수 없습니다",
    };
  }
  return { success: true, artifact };
}
