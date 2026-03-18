import { getMessagesForAgent, insertMessage } from "../store.js";

interface SendMessageInput {
  agent_id: string;
  to?: string | null;
  content: string;
  thread_id?: string;
  /** Arbitrary key-value pairs for structured context (e.g. { task_id: "abc", severity: "high" }) */
  metadata?: Record<string, string>;
}

interface GetMessagesInput {
  agent_id: string;
  /** Sequence cursor. Only messages with seq > after_seq are returned. */
  after_seq?: number;
}

// Send a message and return the message object for broadcasting
export function handleSendMessage(sessionId: string, input: SendMessageInput) {
  try {
    const id = crypto.randomUUID();
    const msg = {
      id,
      session_id: sessionId,
      from_agent: input.agent_id,
      to_agent: input.to ?? null,
      content: input.content,
      thread_id: input.thread_id ?? null,
      metadata: input.metadata ?? null,
    };
    // insertMessage returns { seq, created_at } so the broadcast payload reflects the exact
    // timestamp stored in the in-memory collection, eliminating clock-tick drift.
    const { seq, created_at } = insertMessage(msg);
    return {
      success: true as const,
      message_id: id,
      message: { ...msg, created_at, seq },
    };
  } catch (err) {
    return { success: false as const, error: String(err) };
  }
}

// Fetch messages received by an agent (direct + broadcast, excluding own broadcasts)
export function handleGetMessages(sessionId: string, input: GetMessagesInput) {
  try {
    const messages = getMessagesForAgent(sessionId, input.agent_id, input.after_seq);
    // Exclude broadcasts sent by the requesting agent to prevent self-feedback loops
    const filtered = messages.filter(
      (m) => !(m.to_agent === null && m.from_agent === input.agent_id)
    );
    return { success: true, messages: filtered };
  } catch (err) {
    return { success: false, messages: [], error: String(err) };
  }
}
