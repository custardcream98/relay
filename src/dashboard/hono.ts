// src/dashboard/hono.ts

import { join } from "node:path";
import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { loadAgents } from "../agents/loader";
import { getDb } from "../db/client";
import { getAllArtifacts } from "../db/queries/artifacts";
import { getEventsBySession } from "../db/queries/events";
import { getAllMessages } from "../db/queries/messages";
import { getAllTasks } from "../db/queries/tasks";
import { handleGetSessionSummary } from "../tools/sessions";
import { broadcast } from "./websocket";

const SESSION_ID = process.env.RELAY_SESSION_ID ?? "default";

// hono.ts는 src/dashboard/ 에 위치 → relay 패키지 루트: import.meta.dir + "../.."
const RELAY_PKG_ROOT = join(import.meta.dir, "../..");
const DASHBOARD_DIST = join(RELAY_PKG_ROOT, "dashboard", "dist");

export const app = new Hono();

// 정적 파일 (빌드된 React 앱)
app.use("/assets/*", serveStatic({ root: DASHBOARD_DIST }));

// 에이전트 목록 — 서버 시작 시 한 번 로드 (변경 반영은 재시작 필요)
let cachedAgents: ReturnType<typeof loadAgents> | null = null;

// API: 에이전트 목록
app.get("/api/agents", (c) => {
  if (!cachedAgents) cachedAgents = loadAgents();
  return c.json(
    Object.values(cachedAgents).map((a) => ({
      id: a.id,
      name: a.name,
      emoji: a.emoji,
      description: a.description,
    }))
  );
});

// API: 세션 스냅샷 (초기 로드용)
app.get("/api/session", (c) => {
  const db = getDb();
  return c.json({
    tasks: getAllTasks(db, SESSION_ID),
    messages: getAllMessages(db, SESSION_ID),
    artifacts: getAllArtifacts(db, SESSION_ID),
  });
});

// 세션 이벤트 조회 API (히스토리 재생용)
app.get("/api/sessions/:id/events", (c) => {
  const sessionId = c.req.param("id");
  const events = getEventsBySession(sessionId);
  return c.json({ success: true, events });
});

// 세션 요약 조회 API
app.get("/api/sessions/:id", async (c) => {
  const relayDir = process.env.RELAY_DIR ?? join(process.cwd(), ".relay");
  const result = await handleGetSessionSummary(relayDir, { session_id: c.req.param("id") });
  if (!result.success) return c.json({ error: result.error }, 404);
  return c.json(result);
});

// PostToolUse 훅에서 호출 — agent:status 이벤트를 대시보드에 브로드캐스트
app.post("/api/hook/tool-use", async (c) => {
  // Claude Code가 stdin으로 전달하는 페이로드 구조:
  // { tool_name: "mcp__relay__send_message", tool_input: { agent_id: "pm", ... }, ... }
  let body: { tool_input?: { agent_id?: string } };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "잘못된 JSON 페이로드" }, 400);
  }
  const agent: string = body.tool_input?.agent_id ?? "unknown";
  broadcast({
    type: "agent:status",
    agentId: agent,
    status: "working",
    timestamp: Date.now(),
  });
  return c.json({ ok: true });
});

// SPA fallback: React 앱 라우팅을 위해 모든 경로에서 index.html 반환
app.get("*", (_c) => new Response(Bun.file(join(DASHBOARD_DIST, "index.html"))));
