import { beforeEach, describe, expect, test } from "bun:test";
import { markAsAgentId } from "@custardcream/relay-shared";
import { _resetStore, getEventsBySession, insertEvent } from "../../store";

describe("events queries", () => {
  beforeEach(() => {
    _resetStore();
  });

  test("can store and retrieve events", () => {
    const event = {
      type: "message:new" as const,
      message: {
        id: "1",
        from_agent: "pm",
        to_agent: "fe",
        content: "hello",
        thread_id: null,
        metadata: null,
        created_at: 1000,
      },
      timestamp: Date.now(),
    };
    insertEvent("session-1", JSON.stringify(event), event.type, null, event.timestamp);
    const payloads = getEventsBySession("session-1");
    expect(payloads).toHaveLength(1);
    expect((JSON.parse(payloads[0]) as typeof event).type).toBe("message:new");
  });

  test("events are stored separately per session", () => {
    const makeEvent = (agentId: string) => ({
      type: "agent:status" as const,
      agentId: markAsAgentId(agentId),
      status: "working" as const,
      timestamp: Date.now(),
    });
    const evA = makeEvent("pm");
    const evB = makeEvent("fe");
    insertEvent("session-A", JSON.stringify(evA), evA.type, evA.agentId, evA.timestamp);
    insertEvent("session-B", JSON.stringify(evB), evB.type, evB.agentId, evB.timestamp);
    expect(getEventsBySession("session-A")).toHaveLength(1);
    expect(getEventsBySession("session-B")).toHaveLength(1);
  });
});
