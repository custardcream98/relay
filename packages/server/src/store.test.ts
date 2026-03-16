// packages/server/src/store.test.ts
// Tests for store.ts edge cases not covered by the existing db/queries/* tests.
import { beforeEach, describe, expect, test } from "bun:test";
import {
  _resetStore,
  getAllSessions,
  getArtifactByName,
  getMessagesForAgent,
  insertArtifact,
  insertEvent,
  insertMessage,
  insertTask,
  MAX_MESSAGES_PER_SESSION,
  MAX_TASKS_PER_SESSION,
} from "./store";

beforeEach(() => {
  _resetStore();
});

describe("getMessagesForAgent — afterSeq cursor pagination", () => {
  test("returns all messages when afterSeq is undefined", () => {
    insertMessage({
      id: "m1",
      session_id: "s1",
      from_agent: "pm",
      to_agent: "fe",
      content: "first",
      thread_id: null,
    });
    insertMessage({
      id: "m2",
      session_id: "s1",
      from_agent: "pm",
      to_agent: "fe",
      content: "second",
      thread_id: null,
    });
    const msgs = getMessagesForAgent("s1", "fe");
    expect(msgs).toHaveLength(2);
  });

  test("afterSeq filters out already-seen messages", () => {
    const { seq: seq1 } = insertMessage({
      id: "m1",
      session_id: "s1",
      from_agent: "pm",
      to_agent: "fe",
      content: "first",
      thread_id: null,
    });
    insertMessage({
      id: "m2",
      session_id: "s1",
      from_agent: "pm",
      to_agent: "fe",
      content: "second",
      thread_id: null,
    });
    // afterSeq = seq1 → only messages with seq > seq1 are returned
    const msgs = getMessagesForAgent("s1", "fe", seq1);
    expect(msgs).toHaveLength(1);
    expect(msgs[0].content).toBe("second");
  });

  test("afterSeq = last seq returns empty array", () => {
    const { seq } = insertMessage({
      id: "m1",
      session_id: "s1",
      from_agent: "pm",
      to_agent: "fe",
      content: "only",
      thread_id: null,
    });
    const msgs = getMessagesForAgent("s1", "fe", seq);
    expect(msgs).toHaveLength(0);
  });

  test("seq is monotonically increasing across resets (after _resetStore seq resets to 0)", () => {
    _resetStore();
    const { seq: seq1 } = insertMessage({
      id: "a1",
      session_id: "s1",
      from_agent: "x",
      to_agent: null,
      content: "a",
      thread_id: null,
    });
    const { seq: seq2 } = insertMessage({
      id: "a2",
      session_id: "s1",
      from_agent: "x",
      to_agent: null,
      content: "b",
      thread_id: null,
    });
    expect(seq2).toBeGreaterThan(seq1);
  });

  test("cursor is exclusive — message exactly at afterSeq is not returned", () => {
    const { seq } = insertMessage({
      id: "m1",
      session_id: "s1",
      from_agent: "pm",
      to_agent: null,
      content: "broadcast",
      thread_id: null,
    });
    const msgs = getMessagesForAgent("s1", "fe", seq);
    expect(msgs.find((m) => m.id === "m1")).toBeUndefined();
  });
});

describe("getArtifactByName — latest-wins ordering", () => {
  test("returns the most recently inserted artifact when multiple share the same name", () => {
    insertArtifact({
      id: "art-1",
      session_id: "s1",
      name: "report",
      type: "text",
      content: "v1",
      created_by: "be",
      task_id: null,
    });
    insertArtifact({
      id: "art-2",
      session_id: "s1",
      name: "report",
      type: "text",
      content: "v2",
      created_by: "be",
      task_id: null,
    });
    const artifact = getArtifactByName("s1", "report");
    // Latest artifact (art-2) should win
    expect(artifact?.id).toBe("art-2");
    expect(artifact?.content).toBe("v2");
  });

  test("returns null when no artifact with the given name exists", () => {
    const artifact = getArtifactByName("s1", "nonexistent");
    expect(artifact).toBeNull();
  });

  test("name lookup is session-scoped — does not return artifact from a different session", () => {
    insertArtifact({
      id: "art-x",
      session_id: "other-sess",
      name: "report",
      type: "text",
      content: "other",
      created_by: "be",
      task_id: null,
    });
    const artifact = getArtifactByName("s1", "report");
    expect(artifact).toBeNull();
  });
});

describe("getAllSessions", () => {
  test("returns empty array when no events have been inserted", () => {
    const sessions = getAllSessions();
    expect(sessions).toHaveLength(0);
  });

  test("returns a session entry for each distinct session_id in events", () => {
    insertEvent("sess-a", "{}", "message:new", null, Date.now());
    insertEvent("sess-b", "{}", "message:new", null, Date.now());
    const sessions = getAllSessions();
    const ids = sessions.map((s) => s.id);
    expect(ids).toContain("sess-a");
    expect(ids).toContain("sess-b");
  });

  test("event_count reflects the number of events per session", () => {
    insertEvent("sess-1", "{}", "message:new", null, Date.now());
    insertEvent("sess-1", "{}", "task:updated", null, Date.now());
    insertEvent("sess-1", "{}", "agent:status", "fe", Date.now());
    const sessions = getAllSessions();
    const sess = sessions.find((s) => s.id === "sess-1");
    expect(sess?.event_count).toBe(3);
  });

  test("respects the limit parameter", () => {
    for (let i = 0; i < 5; i++) {
      insertEvent(`sess-${i}`, "{}", "message:new", null, Date.now() + i);
    }
    const sessions = getAllSessions(3);
    expect(sessions).toHaveLength(3);
  });

  test("default limit is 20", () => {
    for (let i = 0; i < 25; i++) {
      insertEvent(`sess-${i}`, "{}", "message:new", null, Date.now() + i);
    }
    const sessions = getAllSessions();
    expect(sessions.length).toBeLessThanOrEqual(20);
  });

  test("sessions are sorted by most recent first (newest created_at first)", () => {
    const now = Date.now();
    // sess-old has an earlier timestamp
    insertEvent("sess-old", "{}", "message:new", null, now - 10000);
    // sess-new has a later timestamp
    insertEvent("sess-new", "{}", "message:new", null, now);
    const sessions = getAllSessions();
    const ids = sessions.map((s) => s.id);
    expect(ids.indexOf("sess-new")).toBeLessThan(ids.indexOf("sess-old"));
  });
});

describe("insertMessage resource limits", () => {
  test("throws when session message limit is reached", () => {
    // Insert exactly MAX-1 messages — all must succeed
    for (let i = 0; i < MAX_MESSAGES_PER_SESSION - 1; i++) {
      insertMessage({
        id: `m-${i}`,
        session_id: "s-limit",
        from_agent: "pm",
        to_agent: null,
        content: `msg ${i}`,
        thread_id: null,
      });
    }
    // The MAX-th insert should still succeed (limit is inclusive at MAX-1, exclusive at MAX)
    expect(() =>
      insertMessage({
        id: `m-${MAX_MESSAGES_PER_SESSION - 1}`,
        session_id: "s-limit",
        from_agent: "pm",
        to_agent: null,
        content: "last allowed",
        thread_id: null,
      })
    ).not.toThrow();
    // The (MAX+1)-th insert must throw
    expect(() =>
      insertMessage({
        id: `m-overflow`,
        session_id: "s-limit",
        from_agent: "pm",
        to_agent: null,
        content: "over limit",
        thread_id: null,
      })
    ).toThrow(`max ${MAX_MESSAGES_PER_SESSION}`);
  });

  test("limit is per-session — a different session is not affected", () => {
    // Fill up s-full
    for (let i = 0; i < MAX_MESSAGES_PER_SESSION; i++) {
      insertMessage({
        id: `full-${i}`,
        session_id: "s-full",
        from_agent: "pm",
        to_agent: null,
        content: `msg ${i}`,
        thread_id: null,
      });
    }
    // s-other must still accept messages
    expect(() =>
      insertMessage({
        id: "other-1",
        session_id: "s-other",
        from_agent: "pm",
        to_agent: null,
        content: "ok",
        thread_id: null,
      })
    ).not.toThrow();
  });
});

describe("insertTask resource limits", () => {
  test("throws when session task limit is reached", () => {
    // Insert exactly MAX-1 tasks — all must succeed
    for (let i = 0; i < MAX_TASKS_PER_SESSION - 1; i++) {
      insertTask({
        id: `t-${i}`,
        session_id: "s-task-limit",
        title: `task ${i}`,
        description: null,
        assignee: null,
        status: "todo",
        priority: "low",
        created_by: "pm",
        depends_on: [],
      });
    }
    // The MAX-th insert should still succeed
    expect(() =>
      insertTask({
        id: `t-${MAX_TASKS_PER_SESSION - 1}`,
        session_id: "s-task-limit",
        title: "last allowed",
        description: null,
        assignee: null,
        status: "todo",
        priority: "low",
        created_by: "pm",
        depends_on: [],
      })
    ).not.toThrow();
    // The (MAX+1)-th insert must throw
    expect(() =>
      insertTask({
        id: "t-overflow",
        session_id: "s-task-limit",
        title: "over limit",
        description: null,
        assignee: null,
        status: "todo",
        priority: "low",
        created_by: "pm",
        depends_on: [],
      })
    ).toThrow(`max ${MAX_TASKS_PER_SESSION}`);
  });

  test("limit is per-session — a different session is not affected", () => {
    // Fill up s-task-full
    for (let i = 0; i < MAX_TASKS_PER_SESSION; i++) {
      insertTask({
        id: `tf-${i}`,
        session_id: "s-task-full",
        title: `task ${i}`,
        description: null,
        assignee: null,
        status: "todo",
        priority: "low",
        created_by: "pm",
        depends_on: [],
      });
    }
    // s-task-other must still accept tasks
    expect(() =>
      insertTask({
        id: "other-t-1",
        session_id: "s-task-other",
        title: "ok",
        description: null,
        assignee: null,
        status: "todo",
        priority: "low",
        created_by: "pm",
        depends_on: [],
      })
    ).not.toThrow();
  });
});
