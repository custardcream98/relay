// src/dashboard/hono.ts
import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { join } from "path";
import { getDb } from "../db/client";
import { getAllMessages } from "../db/queries/messages";
import { getAllTasks } from "../db/queries/tasks";
import { getAllArtifacts } from "../db/queries/artifacts";
import { loadAgents } from "../agents/loader";
// broadcast는 Task 21에서 /api/hook/tool-use 엔드포인트 추가 시 import
// handleGetSessionSummary는 Task 17에서 sessions.ts 구현 후 추가

const SESSION_ID = process.env.RELAY_SESSION_ID ?? "default";

// hono.ts는 src/dashboard/ 에 위치 → relay 패키지 루트: import.meta.dir + "../.."
const RELAY_PKG_ROOT = join(import.meta.dir, "../..");
const DASHBOARD_DIST = join(RELAY_PKG_ROOT, "dashboard", "dist");

export const app = new Hono();

// 정적 파일 (빌드된 React 앱)
app.use("/assets/*", serveStatic({ root: DASHBOARD_DIST }));

// API: 에이전트 목록
app.get("/api/agents", (c) => {
  const agents = loadAgents();
  return c.json(
    Object.values(agents).map(a => ({
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

// /api/sessions/:id 엔드포인트는 Task 17에서 sessions.ts 구현 후 추가

// SPA fallback: React 앱 라우팅을 위해 모든 경로에서 index.html 반환
app.get("*", (c) => new Response(Bun.file(join(DASHBOARD_DIST, "index.html"))));
