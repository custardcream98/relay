// src/dashboard/hono.ts
import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { join } from "path";
import { getDb } from "../db/client";
import { getAllMessages } from "../db/queries/messages";
import { getAllTasks } from "../db/queries/tasks";
import { getAllArtifacts } from "../db/queries/artifacts";
// loadAgents는 Task 12 완료 후 import 추가 예정
// broadcast는 Task 21에서 /api/hook/tool-use 엔드포인트 추가 시 import
// handleGetSessionSummary는 Task 17에서 sessions.ts 구현 후 추가

const SESSION_ID = process.env.RELAY_SESSION_ID ?? "default";

// hono.ts는 src/dashboard/ 에 위치 → relay 패키지 루트: import.meta.dir + "../.."
const RELAY_PKG_ROOT = join(import.meta.dir, "../..");
const DASHBOARD_DIST = join(RELAY_PKG_ROOT, "dashboard", "dist");

export const app = new Hono();

// 정적 파일 (빌드된 React 앱)
app.use("/assets/*", serveStatic({ root: DASHBOARD_DIST }));

// API: 에이전트 목록 (Task 12 이전에는 빈 배열, Task 12 완료 후 실제 구현으로 대체)
app.get("/api/agents", (c) => {
  // TODO: Task 12 완료 후 loadAgents() 사용으로 대체
  return c.json([]);
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
