import { beforeEach, describe, expect, test } from "bun:test";
import { initDb } from "../client.ts";
import { getEventsBySession, insertEvent } from "./events.ts";

describe("events queries", () => {
  beforeEach(() => {
    initDb(":memory:");
  });

  test("이벤트를 저장하고 조회할 수 있다", () => {
    const event = {
      type: "message:new" as const,
      message: {
        id: "1",
        from_agent: "pm",
        to_agent: "fe",
        content: "hello",
        thread_id: null,
        created_at: 1000,
      },
      timestamp: Date.now(),
    };
    insertEvent("session-1", event);
    const events = getEventsBySession("session-1");
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("message:new");
  });

  test("세션별로 이벤트를 분리해서 저장한다", () => {
    const makeEvent = (agentId: string) => ({
      type: "agent:status" as const,
      agentId,
      status: "working" as const,
      timestamp: Date.now(),
    });
    insertEvent("session-A", makeEvent("pm"));
    insertEvent("session-B", makeEvent("fe"));
    expect(getEventsBySession("session-A")).toHaveLength(1);
    expect(getEventsBySession("session-B")).toHaveLength(1);
  });
});
