import type { MessageRow } from "../../store";
import {
  getAllMessages as storeGetAllMessages,
  getMessagesForAgent as storeGetMessagesForAgent,
  insertMessage as storeInsertMessage,
} from "../../store";

export type { MessageRow } from "../../store";

// Insert a message into the in-memory store
export function insertMessage(msg: Omit<MessageRow, "created_at" | "seq">): number {
  return storeInsertMessage(msg);
}

// Fetch messages received by a specific agent (direct + broadcast)
export function getMessagesForAgent(
  sessionId: string,
  agentId: string,
  afterSeq?: number
): MessageRow[] {
  return storeGetMessagesForAgent(sessionId, agentId, afterSeq);
}

// Fetch all messages in a session
export function getAllMessages(sessionId: string): MessageRow[] {
  return storeGetAllMessages(sessionId);
}
