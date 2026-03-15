import type { MessageRow } from "../../store";
import {
  getAllMessages as storeGetAllMessages,
  getMessagesForAgent as storeGetMessagesForAgent,
  insertMessage as storeInsertMessage,
} from "../../store";
import type { SqliteDatabase } from "../types";

export type { MessageRow } from "../../store";

// Insert a message into the in-memory store
export function insertMessage(_db: SqliteDatabase, msg: Omit<MessageRow, "created_at">): void {
  storeInsertMessage(msg);
}

// Fetch messages received by a specific agent (direct + broadcast)
export function getMessagesForAgent(
  _db: SqliteDatabase,
  sessionId: string,
  agentId: string
): MessageRow[] {
  return storeGetMessagesForAgent(sessionId, agentId);
}

// Fetch all messages in a session
export function getAllMessages(_db: SqliteDatabase, sessionId: string): MessageRow[] {
  return storeGetAllMessages(sessionId);
}
