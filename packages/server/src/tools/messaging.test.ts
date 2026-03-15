import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { runMigrations } from "../db/schema";
import { handleGetMessages, handleSendMessage } from "./messaging";

describe("messaging tool", () => {
  let db: Database;

  beforeEach(() => {
    db = new Database(":memory:");
    runMigrations(db);
  });

  afterEach(() => db.close());

  test("send_message: sends message successfully", async () => {
    const result = await handleSendMessage(db, "sess-1", {
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
    await handleSendMessage(db, "sess-1", { agent_id: "pm", to: "fe", content: "Hello" });
    const result = await handleGetMessages(db, "sess-1", { agent_id: "fe" });
    expect(result.success).toBe(true);
    expect(result.messages).toHaveLength(1);
    expect(result.messages[0].from_agent).toBe("pm");
  });

  test("get_messages: does not return messages for other agents", async () => {
    await handleSendMessage(db, "sess-1", { agent_id: "pm", to: "be", content: "For BE only" });
    const result = await handleGetMessages(db, "sess-1", { agent_id: "fe" });
    expect(result.messages.filter((m) => m.to_agent === "be")).toHaveLength(0);
  });
});
