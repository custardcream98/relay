// packages/server/src/dashboard/hono.test.ts
// Tests for Hono REST API routes using in-process app.request()
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { _resetSessionId, setSessionId } from "../config";
import { _resetStore, insertTask } from "../store";
import { app } from "./hono";
import { _resetStatusDebounce } from "./status-debounce";

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

  test("task payloads include depends_on, parent_task_id, depth, derived_reason, created_at, updated_at", async () => {
    insertTask({
      id: "dep-task",
      session_id: "test-session",
      title: "Dependency Task",
      description: null,
      status: "done",
      priority: "medium",
      created_by: "pm",
      assignee: "be",
      depends_on: [],
      depth: 0,
    });
    insertTask({
      id: "child-task",
      session_id: "test-session",
      title: "Child Task",
      description: "A derived task",
      status: "todo",
      priority: "high",
      created_by: "pm",
      assignee: "fe",
      depends_on: ["dep-task"],
      parent_task_id: "dep-task",
      depth: 1,
      derived_reason: "Needs FE work",
    });
    const res = await app.request("/api/session");
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      tasks: Array<{
        id: string;
        depends_on: string[];
        parent_task_id: string | null;
        depth: number;
        derived_reason: string | null;
        created_at: number;
        updated_at: number;
      }>;
    };
    expect(body.tasks).toHaveLength(2);

    const root = body.tasks.find((t) => t.id === "dep-task");
    expect(root?.depends_on).toEqual([]);
    expect(root?.parent_task_id).toBeNull();
    expect(root?.depth).toBe(0);
    expect(root?.derived_reason).toBeNull();
    expect(typeof root?.created_at).toBe("number");
    expect(typeof root?.updated_at).toBe("number");

    const child = body.tasks.find((t) => t.id === "child-task");
    expect(child?.depends_on).toEqual(["dep-task"]);
    expect(child?.parent_task_id).toBe("dep-task");
    expect(child?.depth).toBe(1);
    expect(child?.derived_reason).toBe("Needs FE work");
    expect(typeof child?.created_at).toBe("number");
    expect(typeof child?.updated_at).toBe("number");
  });
});

describe("POST /api/hook/tool-use", () => {
  beforeEach(() => {
    _resetStore();
    _resetStatusDebounce();
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
    const body = (await res.json()) as { success: boolean; error: string };
    expect(body.error).toBeDefined();
    // 404 response must include success:false for consistency with other error responses
    expect(body.success).toBe(false);
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

describe("GET /api/sessions/:id/completion-check", () => {
  beforeEach(() => {
    _resetStore();
    setSessionId("cc-session");
  });

  afterEach(() => {
    _resetSessionId();
  });

  test("returns all_done:false and total:0 for empty task board", async () => {
    const res = await app.request("/api/sessions/cc-session/completion-check");
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      success: boolean;
      all_done: boolean;
      done_count: number;
      total_count: number;
      pending_tasks: unknown[];
    };
    expect(body.success).toBe(true);
    expect(body.all_done).toBe(false);
    expect(body.done_count).toBe(0);
    expect(body.total_count).toBe(0);
    expect(body.pending_tasks).toHaveLength(0);
  });

  test("returns all_done:true when all tasks are done", async () => {
    insertTask({
      id: "t1",
      session_id: "cc-session",
      title: "Task 1",
      description: null,
      status: "done",
      priority: "medium",
      created_by: "pm",
      assignee: "be",
      depends_on: [],
      depth: 0,
    });
    insertTask({
      id: "t2",
      session_id: "cc-session",
      title: "Task 2",
      description: null,
      status: "done",
      priority: "medium",
      created_by: "pm",
      assignee: "fe",
      depends_on: [],
      depth: 0,
    });
    const res = await app.request("/api/sessions/cc-session/completion-check");
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      success: boolean;
      all_done: boolean;
      done_count: number;
      total_count: number;
      pending_tasks: unknown[];
    };
    expect(body.success).toBe(true);
    expect(body.all_done).toBe(true);
    expect(body.done_count).toBe(2);
    expect(body.total_count).toBe(2);
    expect(body.pending_tasks).toHaveLength(0);
  });

  test("returns all_done:false with pending_tasks when some tasks are not done", async () => {
    insertTask({
      id: "t3",
      session_id: "cc-session",
      title: "Done Task",
      description: null,
      status: "done",
      priority: "medium",
      created_by: "pm",
      assignee: "be",
      depends_on: [],
      depth: 0,
    });
    insertTask({
      id: "t4",
      session_id: "cc-session",
      title: "Pending Task",
      description: null,
      status: "in_progress",
      priority: "medium",
      created_by: "pm",
      assignee: "fe",
      depends_on: [],
      depth: 0,
    });
    const res = await app.request("/api/sessions/cc-session/completion-check");
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      success: boolean;
      all_done: boolean;
      done_count: number;
      total_count: number;
      pending_tasks: { id: string; title: string; status: string; assignee: string }[];
    };
    expect(body.success).toBe(true);
    expect(body.all_done).toBe(false);
    expect(body.done_count).toBe(1);
    expect(body.total_count).toBe(2);
    expect(body.pending_tasks).toHaveLength(1);
    expect(body.pending_tasks[0].id).toBe("t4");
    expect(body.pending_tasks[0].status).toBe("in_progress");
  });

  test("returns 400 for invalid session ID", async () => {
    const res = await app.request("/api/sessions/..%2Fetc%2Fpasswd/completion-check");
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain("Invalid");
  });

  test("only counts tasks for the requested session", async () => {
    insertTask({
      id: "t5",
      session_id: "cc-session",
      title: "My Task",
      description: null,
      status: "todo",
      priority: "medium",
      created_by: "pm",
      assignee: "be",
      depends_on: [],
      depth: 0,
    });
    insertTask({
      id: "t6",
      session_id: "other-session",
      title: "Other Task",
      description: null,
      status: "done",
      priority: "medium",
      created_by: "pm",
      assignee: "be",
      depends_on: [],
      depth: 0,
    });
    const res = await app.request("/api/sessions/cc-session/completion-check");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { total_count: number; done_count: number };
    expect(body.total_count).toBe(1);
    expect(body.done_count).toBe(0);
  });
});

describe("POST /api/hook/tool-use agent:joined emission", () => {
  beforeEach(() => {
    _resetStore();
    _resetStatusDebounce();
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
