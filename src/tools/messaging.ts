import type { Database } from "bun:sqlite";
import { randomUUID } from "node:crypto";
import { getMessagesForAgent, insertMessage } from "../db/queries/messages";

interface SendMessageInput {
  agent_id: string;
  to?: string | null;
  content: string;
  thread_id?: string;
}

interface GetMessagesInput {
  agent_id: string;
}

// 메시지를 전송하고 broadcast용 메시지 객체를 반환한다
export async function handleSendMessage(db: Database, sessionId: string, input: SendMessageInput) {
  const id = randomUUID();
  const msg = {
    id,
    session_id: sessionId,
    from_agent: input.agent_id,
    to_agent: input.to ?? null,
    content: input.content,
    thread_id: input.thread_id ?? null,
  };
  insertMessage(db, msg);
  // DB는 unixepoch()(초) 사용 — broadcast용 created_at도 초 단위로 통일
  return {
    success: true,
    message_id: id,
    message: { ...msg, created_at: Math.floor(Date.now() / 1000) },
  };
}

// 에이전트가 수신한 메시지(직접 수신 + 브로드캐스트)를 조회한다
export async function handleGetMessages(db: Database, sessionId: string, input: GetMessagesInput) {
  const messages = getMessagesForAgent(db, sessionId, input.agent_id);
  return { success: true, messages };
}
