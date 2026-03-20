import { beforeEach, describe, expect, test } from "bun:test";

import { _resetStore } from "../store";
import { handleGetMessages, handleSendMessage } from "./messaging";

describe("messaging tool", () => {
  beforeEach(() => {
    _resetStore();
  });

  test("send_message: sends message successfully", async () => {
    const result = await handleSendMessage("sess-1", {
      agent_id: "pm",
      to: "fe",
      content: "Please review the PR",
    });
    expect(result.success).toBe(true);
    expect(result.message_id).toBeDefined();
    expect(result.message).toBeDefined();
    if (!result.success) return;
    expect(result.message.from_agent).toBe("pm");
    expect(result.message.to_agent).toBe("fe");
    expect(typeof result.message.created_at).toBe("number");
  });

  test("get_messages: retrieves received messages", async () => {
    await handleSendMessage("sess-1", { agent_id: "pm", to: "fe", content: "Hello" });
    const result = await handleGetMessages("sess-1", { agent_id: "fe" });
    expect(result.success).toBe(true);
    expect(result.messages).toHaveLength(1);
    expect(result.messages[0].from_agent).toBe("pm");
  });

  test("get_messages: does not return messages for other agents", async () => {
    await handleSendMessage("sess-1", { agent_id: "pm", to: "be", content: "For BE only" });
    const result = await handleGetMessages("sess-1", { agent_id: "fe" });
    expect(result.messages).toHaveLength(0);
  });

  test("get_messages: sender does not see their own broadcast in results", async () => {
    await handleSendMessage("sess-1", { agent_id: "pm", to: null, content: "Broadcast" });
    const result = await handleGetMessages("sess-1", { agent_id: "pm" });
    expect(result.messages).toHaveLength(0); // pm sent it, so pm should not receive it back
  });

  test("get_messages: after_seq cursor returns only newer messages", async () => {
    await handleSendMessage("sess-1", { agent_id: "pm", to: "fe", content: "First" });
    await handleSendMessage("sess-1", { agent_id: "pm", to: "fe", content: "Second" });
    const all = await handleGetMessages("sess-1", { agent_id: "fe" });
    expect(all.messages).toHaveLength(2);

    // Cursor at seq of first message — should only return the second
    const firstSeq = all.messages[0].seq;
    const partial = await handleGetMessages("sess-1", { agent_id: "fe", after_seq: firstSeq });
    expect(partial.messages).toHaveLength(1);
    expect(partial.messages[0].content).toBe("Second");
    expect(partial.messages.every((m) => m.seq > firstSeq)).toBe(true);

    // Cursor beyond all messages — should return nothing
    const maxSeq = Math.max(...all.messages.map((m) => m.seq));
    const none = await handleGetMessages("sess-1", { agent_id: "fe", after_seq: maxSeq });
    expect(none.messages).toHaveLength(0);
  });
});
