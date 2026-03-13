// src/dashboard/hono.ts
import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { join } from "path";
import { getDb } from "../db/client";
import { getAllMessages } from "../db/queries/messages";
import { getAllTasks } from "../db/queries/tasks";
import { getAllArtifacts } from "../db/queries/artifacts";
import { loadAgents } from "../agents/loader";
import { handleGetSessionSummary } from "../tools/sessions";
// broadcast는 Task 21에서 /api/hook/tool-use 엔드포인트 추가 시 import

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
    Object.values(cachedAgents).map(a => ({
      id: a.id, name: a.name, emoji: a.emoji, description: a.description,
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

// 세션 요약 조회 API
app.get("/api/sessions/:id", async (c) => {
  const relayDir = process.env.RELAY_DIR ?? join(process.cwd(), ".relay");
  const result = await handleGetSessionSummary(relayDir, { session_id: c.req.param("id") });
  if (!result.success) return c.json({ error: result.error }, 404);
  return c.json(result);
});

// SPA fallback: React 앱 라우팅을 위해 모든 경로에서 index.html 반환
app.get("*", (c) => new Response(Bun.file(join(DASHBOARD_DIST, "index.html"))));
