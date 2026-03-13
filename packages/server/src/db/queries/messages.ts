import type { Database } from "bun:sqlite";

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
export function insertMessage(db: Database, msg: Omit<MessageRow, "created_at">): void {
  db.query(`
    INSERT INTO messages (id, session_id, from_agent, to_agent, content, thread_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(msg.id, msg.session_id, msg.from_agent, msg.to_agent, msg.content, msg.thread_id);
}

// Fetch messages received by a specific agent (direct + broadcast)
export function getMessagesForAgent(
  db: Database,
  sessionId: string,
  agentId: string
): MessageRow[] {
  return db
    .query<MessageRow, [string, string]>(`
    SELECT * FROM messages
    WHERE session_id = ?
      AND (to_agent = ? OR to_agent IS NULL)
    ORDER BY created_at ASC
  `)
    .all(sessionId, agentId) as MessageRow[];
}

// Fetch all messages in a session
export function getAllMessages(db: Database, sessionId: string): MessageRow[] {
  return db
    .query<MessageRow, [string]>(`
    SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC
  `)
    .all(sessionId) as MessageRow[];
}
