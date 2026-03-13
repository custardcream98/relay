import { getMessagesForAgent, insertMessage } from "../db/queries/messages";
import type { SqliteDatabase } from "../db/types";

interface SendMessageInput {
  agent_id: string;
  to?: string | null;
  content: string;
  thread_id?: string;
}

interface GetMessagesInput {
  agent_id: string;
}

// Send a message and return the message object for broadcasting
export function handleSendMessage(db: SqliteDatabase, sessionId: string, input: SendMessageInput) {
  const id = crypto.randomUUID();
  const msg = {
    id,
    session_id: sessionId,
    from_agent: input.agent_id,
    to_agent: input.to ?? null,
    content: input.content,
    thread_id: input.thread_id ?? null,
  };
  insertMessage(db, msg);
  // DB uses unixepoch() (seconds) — align broadcast created_at to seconds as well
  return {
    success: true,
    message_id: id,
    message: { ...msg, created_at: Math.floor(Date.now() / 1000) },
  };
}

// Fetch messages received by an agent (direct + broadcast)
export function handleGetMessages(db: SqliteDatabase, sessionId: string, input: GetMessagesInput) {
  const messages = getMessagesForAgent(db, sessionId, input.agent_id);
  return { success: true, messages };
}
