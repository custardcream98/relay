import { getArtifactByName, insertArtifact } from "../store";

export function handlePostArtifact(
  sessionId: string,
  input: {
    agent_id: string;
    name: string;
    type: string;
    content: string;
    task_id?: string;
  }
) {
  try {
    const id = crypto.randomUUID();
    insertArtifact({
      id,
      session_id: sessionId,
      name: input.name,
      type: input.type,
      content: input.content,
      created_by: input.agent_id,
      task_id: input.task_id ?? null,
    });
    return { success: true, artifact_id: id };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

export function handleGetArtifact(sessionId: string, input: { agent_id: string; name: string }) {
  try {
    const artifact = getArtifactByName(sessionId, input.name);
    if (!artifact) {
      return {
        success: false,
        artifact: null,
        error: "artifact not found",
      };
    }
    return { success: true, artifact };
  } catch (err) {
    return { success: false, artifact: null, error: String(err) };
  }
}
