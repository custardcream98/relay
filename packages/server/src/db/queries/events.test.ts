import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { _setDb, closeDb } from "../client.ts";
import { runMigrations } from "../schema.ts";
import type { SqliteDatabase } from "../types.ts";
import { getEventsBySession, insertEvent } from "./events.ts";

describe("events queries", () => {
  beforeEach(() => {
    const db = new Database(":memory:");
    runMigrations(db as unknown as SqliteDatabase);
    _setDb(db as unknown as SqliteDatabase);
  });

  afterEach(() => closeDb());

  test("can store and retrieve events", () => {
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

  test("events are stored separately per session", () => {
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
