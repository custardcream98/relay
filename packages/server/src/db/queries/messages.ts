import type { SqliteDatabase } from "../types";

export interface MessageRow {
  id: string;
  session_id: string;
  from_agent: string;
  to_agent: string | null;
  content: string;
  thread_id: string | null;
  created_at: number;
}

// Insert a message into the DB
export function insertMessage(db: SqliteDatabase, msg: Omit<MessageRow, "created_at">): void {
  db.prepare(`
    INSERT INTO messages (id, session_id, from_agent, to_agent, content, thread_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(msg.id, msg.session_id, msg.from_agent, msg.to_agent, msg.content, msg.thread_id);
}

// Fetch messages received by a specific agent (direct + broadcast)
export function getMessagesForAgent(
  db: SqliteDatabase,
  sessionId: string,
  agentId: string
): MessageRow[] {
  return db
    .prepare(`
    SELECT * FROM messages
    WHERE session_id = ?
      AND (to_agent = ? OR to_agent IS NULL)
    ORDER BY created_at ASC
  `)
    .all(sessionId, agentId) as MessageRow[];
}

// Fetch all messages in a session
export function getAllMessages(db: SqliteDatabase, sessionId: string): MessageRow[] {
  return db
    .prepare(`
    SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC
  `)
    .all(sessionId) as MessageRow[];
}
