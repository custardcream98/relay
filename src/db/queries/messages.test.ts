import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { Database } from "bun:sqlite";
import { runMigrations } from "../schema";
import { insertMessage, getMessagesForAgent } from "./messages";

describe("메시지 쿼리", () => {
  let db: Database;

  beforeEach(() => {
    db = new Database(":memory:");
    runMigrations(db);
  });

  afterEach(() => db.close());

  test("메시지 삽입 및 조회", () => {
    insertMessage(db, {
      id: "msg-1",
      session_id: "sess-1",
      from_agent: "pm",
      to_agent: "fe",
      content: "PR 리뷰 부탁해",
      thread_id: null,
    });

    const msgs = getMessagesForAgent(db, "sess-1", "fe");
    expect(msgs).toHaveLength(1);
    expect(msgs[0].content).toBe("PR 리뷰 부탁해");
  });

  test("브로드캐스트 메시지 (to_agent=null) 전체 조회", () => {
    insertMessage(db, {
      id: "msg-2",
      session_id: "sess-1",
      from_agent: "pm",
      to_agent: null,
      content: "전체 공지",
      thread_id: null,
    });

    const msgs = getMessagesForAgent(db, "sess-1", "fe");
    expect(msgs.some(m => m.id === "msg-2")).toBe(true);
  });
});
