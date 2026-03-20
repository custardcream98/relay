import { beforeEach, describe, expect, test } from "bun:test";

import { _resetStore, getMessagesForAgent, insertMessage } from "../../store";

describe("message queries", () => {
  beforeEach(() => {
    _resetStore();
  });

  test("insert and fetch messages", () => {
    insertMessage({
      id: "msg-1",
      session_id: "sess-1",
      from_agent: "pm",
      to_agent: "fe",
      content: "Please review the PR",
      thread_id: null,
    });

    const msgs = getMessagesForAgent("sess-1", "fe");
    expect(msgs).toHaveLength(1);
    expect(msgs[0].content).toBe("Please review the PR");
  });

  test("fetch broadcast messages (to_agent=null)", () => {
    insertMessage({
      id: "msg-2",
      session_id: "sess-1",
      from_agent: "pm",
      to_agent: null,
      content: "Broadcast announcement",
      thread_id: null,
    });

    const msgs = getMessagesForAgent("sess-1", "fe");
    expect(msgs.some((m) => m.id === "msg-2")).toBe(true);
  });
});
