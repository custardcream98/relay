import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { runMigrations } from "../schema";
import { getMessagesForAgent, insertMessage } from "./messages";

describe("message queries", () => {
  let db: Database;

  beforeEach(() => {
    db = new Database(":memory:");
    runMigrations(db);
  });

  afterEach(() => db.close());

  test("insert and fetch messages", () => {
    insertMessage(db, {
      id: "msg-1",
      session_id: "sess-1",
      from_agent: "pm",
      to_agent: "fe",
      content: "Please review the PR",
      thread_id: null,
    });

    const msgs = getMessagesForAgent(db, "sess-1", "fe");
    expect(msgs).toHaveLength(1);
    expect(msgs[0].content).toBe("Please review the PR");
  });

  test("fetch broadcast messages (to_agent=null)", () => {
    insertMessage(db, {
      id: "msg-2",
      session_id: "sess-1",
      from_agent: "pm",
      to_agent: null,
      content: "Broadcast announcement",
      thread_id: null,
    });

    const msgs = getMessagesForAgent(db, "sess-1", "fe");
    expect(msgs.some((m) => m.id === "msg-2")).toBe(true);
  });
});
