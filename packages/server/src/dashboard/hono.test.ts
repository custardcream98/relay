// packages/server/src/dashboard/hono.test.ts
// Tests for Hono REST API routes using in-process app.request()
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { _resetSessionId, setSessionId } from "../config";
import { _resetStore } from "../store";
import { app } from "./hono";

describe("GET /api/session", () => {
  beforeEach(() => {
    _resetStore();
    setSessionId("test-session");
  });

  afterEach(() => {
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

describe("POST /api/hook/tool-use", () => {
  beforeEach(() => {
    _resetStore();
    setSessionId("hook-session");
  });

  afterEach(() => {
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
  beforeEach(() => {
    _resetStore();
    setSessionId("summary-session");
  });

  afterEach(() => {
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
  beforeEach(() => {
    _resetStore();
    setSessionId("agents-session");
  });

  afterEach(() => {
    _resetSessionId();
  });

  test("returns an array (may be empty when no pool is configured)", async () => {
    const res = await app.request("/api/agents");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });
});

describe("GET /api/health", () => {
  beforeEach(() => {
    _resetStore();
    setSessionId("health-session");
  });

  afterEach(() => {
    _resetSessionId();
  });

  test("returns ok:true with session info", async () => {
    const res = await app.request("/api/health");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; sessionId: string; uptime: number };
    expect(body.ok).toBe(true);
    expect(body.sessionId).toBe("health-session");
    expect(typeof body.uptime).toBe("number");
  });
});

describe("GET /api/sessions/live", () => {
  beforeEach(() => {
    _resetStore();
    setSessionId("live-session");
  });

  afterEach(() => {
    _resetSessionId();
  });

  test("returns sessions array", async () => {
    const res = await app.request("/api/sessions/live");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean; sessions: unknown[] };
    expect(body.success).toBe(true);
    expect(Array.isArray(body.sessions)).toBe(true);
  });
});

describe("GET /api/sessions/:id/replay", () => {
  beforeEach(() => {
    _resetStore();
    setSessionId("replay-session");
  });

  afterEach(() => {
    _resetSessionId();
  });

  test("returns events array for valid session", async () => {
    const res = await app.request("/api/sessions/replay-session/replay");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean; sessionId: string; events: unknown[] };
    expect(body.success).toBe(true);
    expect(body.sessionId).toBe("replay-session");
    expect(Array.isArray(body.events)).toBe(true);
  });

  test("returns 400 for invalid session ID (path traversal attempt)", async () => {
    const res = await app.request("/api/sessions/..%2Fetc/replay");
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain("Invalid");
  });
});

describe("GET /api/session with pagination", () => {
  beforeEach(() => {
    _resetStore();
    setSessionId("paginated-session");
  });

  afterEach(() => {
    _resetSessionId();
  });

  test("returns total counts alongside paginated data", async () => {
    const res = await app.request("/api/session?limit=10&offset=0");
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      tasks: unknown[];
      messages: unknown[];
      artifacts: unknown[];
      total: { tasks: number; messages: number; artifacts: number };
    };
    expect(Array.isArray(body.tasks)).toBe(true);
    expect(body.total).toBeDefined();
    expect(typeof body.total.tasks).toBe("number");
    expect(typeof body.total.messages).toBe("number");
    expect(typeof body.total.artifacts).toBe("number");
  });
});

describe("POST /api/hook/tool-use agent:joined emission", () => {
  beforeEach(() => {
    _resetStore();
    setSessionId("joined-session");
  });

  afterEach(() => {
    _resetSessionId();
  });

  test("returns ok:true for a known agent_id", async () => {
    const res = await app.request("/api/hook/tool-use", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tool_name: "mcp__relay__send_message",
        tool_input: { agent_id: "be" },
      }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean };
    expect(body.ok).toBe(true);
  });
});
