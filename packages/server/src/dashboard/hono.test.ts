// packages/server/src/dashboard/hono.test.ts
// Tests for Hono REST API routes using in-process app.request()
import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { _resetSessionId, setSessionId } from "../config";
import { _setDb, closeDb } from "../db/client";
import { runMigrations } from "../db/schema";
import type { SqliteDatabase } from "../db/types";
import { app } from "./hono";

// Helpers to inject a fresh in-memory DB per test
function makeDb(): Database {
  const db = new Database(":memory:");
  runMigrations(db as unknown as SqliteDatabase);
  return db;
}

describe("GET /api/session", () => {
  let db: Database;

  beforeEach(() => {
    db = makeDb();
    _setDb(db as unknown as SqliteDatabase);
    setSessionId("test-session");
  });

  afterEach(() => {
    closeDb();
    _resetSessionId();
  });

  test("returns tasks, messages, and artifacts for the current session", async () => {
    const res = await app.request("/api/session");
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      tasks: unknown[];
      messages: unknown[];
      artifacts: unknown[];
    };
    expect(Array.isArray(body.tasks)).toBe(true);
    expect(Array.isArray(body.messages)).toBe(true);
    expect(Array.isArray(body.artifacts)).toBe(true);
  });

  test("returns empty arrays when no data exists", async () => {
    const res = await app.request("/api/session");
    const body = (await res.json()) as {
      tasks: unknown[];
      messages: unknown[];
      artifacts: unknown[];
    };
    expect(body.tasks).toHaveLength(0);
    expect(body.messages).toHaveLength(0);
    expect(body.artifacts).toHaveLength(0);
  });
});

describe("GET /api/sessions/:id/snapshot", () => {
  let db: Database;

  beforeEach(() => {
    db = makeDb();
    _setDb(db as unknown as SqliteDatabase);
    setSessionId("snapshot-session");
  });

  afterEach(() => {
    closeDb();
    _resetSessionId();
  });

  test("returns snapshot with session_id field for valid session", async () => {
    const res = await app.request("/api/sessions/snapshot-session/snapshot");
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      session_id: string;
      tasks: unknown[];
      messages: unknown[];
      artifacts: unknown[];
    };
    expect(body.session_id).toBe("snapshot-session");
    expect(Array.isArray(body.tasks)).toBe(true);
    expect(Array.isArray(body.messages)).toBe(true);
    expect(Array.isArray(body.artifacts)).toBe(true);
  });

  test("rejects session_id with path traversal characters (400)", async () => {
    const res = await app.request("/api/sessions/..%2Fetc%2Fpasswd/snapshot");
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain("Invalid");
  });

  test("rejects session_id with slash characters (400)", async () => {
    const res = await app.request("/api/sessions/bad%2Fid/snapshot");
    expect(res.status).toBe(400);
  });

  test("rejects session_id with special characters (400)", async () => {
    const res = await app.request("/api/sessions/bad%20id/snapshot");
    expect(res.status).toBe(400);
  });

  test("accepts alphanumeric session_id with hyphens and underscores", async () => {
    const res = await app.request("/api/sessions/2026-03-15-001_abc/snapshot");
    expect(res.status).toBe(200);
  });
});

describe("GET /api/sessions/:id/events", () => {
  let db: Database;

  beforeEach(() => {
    db = makeDb();
    _setDb(db as unknown as SqliteDatabase);
    setSessionId("events-session");
  });

  afterEach(() => {
    closeDb();
    _resetSessionId();
  });

  test("returns events array for valid session_id", async () => {
    const res = await app.request("/api/sessions/events-session/events");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean; events: unknown[] };
    expect(body.success).toBe(true);
    expect(Array.isArray(body.events)).toBe(true);
  });

  test("rejects invalid session_id with path traversal (400)", async () => {
    const res = await app.request("/api/sessions/..%2F..%2Fsecret/events");
    expect(res.status).toBe(400);
  });
});

describe("GET /api/sessions", () => {
  let db: Database;

  beforeEach(() => {
    db = makeDb();
    _setDb(db as unknown as SqliteDatabase);
    setSessionId("list-session");
  });

  afterEach(() => {
    closeDb();
    _resetSessionId();
  });

  test("returns an array of sessions", async () => {
    const res = await app.request("/api/sessions");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });
});

describe("POST /api/hook/tool-use", () => {
  let db: Database;

  beforeEach(() => {
    db = makeDb();
    _setDb(db as unknown as SqliteDatabase);
    setSessionId("hook-session");
  });

  afterEach(() => {
    closeDb();
    _resetSessionId();
  });

  test("returns ok:true for valid tool-use payload", async () => {
    const res = await app.request("/api/hook/tool-use", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tool_name: "mcp__relay__send_message",
        tool_input: { agent_id: "pm" },
      }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean };
    expect(body.ok).toBe(true);
  });

  test("uses 'unknown' as agentId when tool_input is absent", async () => {
    const res = await app.request("/api/hook/tool-use", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tool_name: "mcp__relay__get_messages" }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean };
    expect(body.ok).toBe(true);
  });

  test("returns 400 for non-JSON body", async () => {
    const res = await app.request("/api/hook/tool-use", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json at all",
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain("invalid JSON");
  });

  test("returns 403 when Origin header is a non-localhost domain", async () => {
    const res = await app.request("/api/hook/tool-use", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://evil.example.com",
      },
      body: JSON.stringify({ tool_name: "mcp__relay__send_message" }),
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("forbidden");
  });

  test("returns 403 when Origin header is malformed", async () => {
    const res = await app.request("/api/hook/tool-use", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "not-a-valid-origin",
      },
      body: JSON.stringify({ tool_name: "mcp__relay__send_message" }),
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("forbidden");
  });
});

describe("GET /api/sessions/:id", () => {
  let db: Database;

  beforeEach(() => {
    db = makeDb();
    _setDb(db as unknown as SqliteDatabase);
    setSessionId("summary-session");
  });

  afterEach(() => {
    closeDb();
    _resetSessionId();
  });

  test("returns 400 for session ID with encoded path traversal", async () => {
    const res = await app.request("/api/sessions/..%2Fetc%2Fpasswd");
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain("Invalid");
  });

  test("returns 400 for session ID with spaces (encoded)", async () => {
    const res = await app.request("/api/sessions/bad%20session%20id");
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain("Invalid");
  });

  test("returns 404 for valid but unknown session ID", async () => {
    const res = await app.request("/api/sessions/nonexistent-session-xyz");
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBeDefined();
  });
});

describe("GET /api/agents", () => {
  let db: Database;

  beforeEach(() => {
    db = makeDb();
    _setDb(db as unknown as SqliteDatabase);
    setSessionId("agents-session");
  });

  afterEach(() => {
    closeDb();
    _resetSessionId();
  });

  test("returns an array (may be empty when no pool is configured)", async () => {
    const res = await app.request("/api/agents");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });
});
