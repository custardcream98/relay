import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { Database } from "bun:sqlite";
import { runMigrations } from "../db/schema";
import { handleSendMessage, handleGetMessages } from "./messaging";

describe("messaging 툴", () => {
  let db: Database;

  beforeEach(() => {
    db = new Database(":memory:");
    runMigrations(db);
  });

  afterEach(() => db.close());

  test("send_message: 메시지 전송 성공", async () => {
    const result = await handleSendMessage(db, "sess-1", {
      agent_id: "pm",
      to: "fe",
      content: "PR 리뷰 부탁해요",
    });
    expect(result.success).toBe(true);
    expect(result.message_id).toBeDefined();
  });

  test("get_messages: 수신 메시지 조회", async () => {
    await handleSendMessage(db, "sess-1", { agent_id: "pm", to: "fe", content: "안녕" });
    const result = await handleGetMessages(db, "sess-1", { agent_id: "fe" });
    expect(result.success).toBe(true);
    expect(result.messages).toHaveLength(1);
    expect(result.messages[0].from_agent).toBe("pm");
  });

  test("get_messages: 다른 에이전트 메시지는 조회 안 됨", async () => {
    await handleSendMessage(db, "sess-1", { agent_id: "pm", to: "be", content: "BE에게만" });
    const result = await handleGetMessages(db, "sess-1", { agent_id: "fe" });
    expect(result.messages.filter(m => m.to_agent === "be")).toHaveLength(0);
  });
});
