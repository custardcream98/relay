# relay 코어 구현 계획

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Claude Code sub-agent들이 MCP 툴로 peer-to-peer 소통하며 스타트업처럼 협업하는 멀티 에이전트 프레임워크 구현

**Architecture:** MCP 서버(stdio)가 에이전트 간 통신 인프라(메시지 버스, 태스크 보드, 아티팩트 저장소, 메모리)를 담당하고, Hono가 같은 프로세스에서 HTTP API + WebSocket을 서빙한다. 세션 데이터는 bun:sqlite에, 프로젝트 장기 기억은 `.relay/memory/` 파일에 영속화된다. Claude API 직접 호출 없이 Claude Code Agent 툴만 사용한다.

**Tech Stack:** Bun, TypeScript (strict), `@modelcontextprotocol/sdk`, Hono, `bun:sqlite`, React + Vite, Tailwind CSS

---

## 파일 구조

```
relay/
├── src/                              # MCP + API 서버
│   ├── index.ts                      # 진입점: MCP + Hono 서버 동시 기동
│   ├── mcp.ts                        # MCP 서버 인스턴스 및 툴 등록
│   ├── db/
│   │   ├── client.ts                 # DB 싱글톤 (bun:sqlite)
│   │   ├── schema.ts                 # 테이블 DDL 및 마이그레이션
│   │   └── queries/
│   │       ├── messages.ts           # messages 테이블 CRUD
│   │       ├── tasks.ts              # tasks 테이블 CRUD
│   │       ├── artifacts.ts          # artifacts 테이블 CRUD
│   │       ├── reviews.ts            # reviews 테이블 CRUD
│   │       └── events.ts             # events 테이블 (히스토리 로그)
│   ├── tools/
│   │   ├── messaging.ts              # send_message, get_messages
│   │   ├── tasks.ts                  # create_task, update_task, get_my_tasks
│   │   ├── artifacts.ts              # post_artifact, get_artifact
│   │   ├── review.ts                 # request_review, submit_review
│   │   ├── memory.ts                 # read_memory, write_memory, append_memory
│   │   └── sessions.ts               # list_sessions, save_session_summary, get_session_summary
│   ├── agents/
│   │   ├── types.ts                  # AgentId, AgentPersona, AgentConfig 타입
│   │   └── loader.ts                 # agents.yml 로드 + 기본값 merge
│   └── dashboard/
│       ├── hono.ts                   # Hono 앱: REST API 라우트
│       ├── websocket.ts              # WebSocket 브로드캐스터
│       └── events.ts                 # RelayEvent 유니온 타입
├── dashboard/                        # React 프론트엔드 (별도 Vite 패키지)
│   ├── index.html
│   ├── vite.config.ts
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── types.ts                  # 서버와 공유하는 이벤트/도메인 타입
│   │   ├── hooks/
│   │   │   └── useRelaySocket.ts     # WebSocket 연결 + 이벤트 구독 훅
│   │   └── components/
│   │       ├── AgentStatusBar.tsx    # 에이전트 활성 상태 표시줄
│   │       ├── TaskBoard.tsx         # Kanban (Todo / In Progress / Done)
│   │       ├── MessageFeed.tsx       # 에이전트 간 메시지 스레드
│   │       └── AgentThoughts.tsx     # 선택 에이전트 사고 스트림
│   └── package.json
├── shared/
│   └── types.ts                      # 서버-대시보드 공유 타입 (RelayEvent, AgentId)
├── skills/                           # Claude Code 스킬 (설치 시 .claude/skills/에 복사)
│   ├── relay.md                      # /relay - 전체 워크플로 오케스트레이션 전략
│   ├── relay-init.md                 # /relay-init - 프로젝트 파악 전략
│   └── relay-agent.md                # /relay-agent - 단일 에이전트 호출 전략
├── scripts/
│   └── install.ts                    # 글로벌/로컬 설치 스크립트
├── agents.default.yml                # 기본 페르소나 (패키지 내장, 수정 비권장)
├── agents.yml                        # 사용자 커스텀 페르소나 (없으면 default 사용)
├── biome.json                        # Biome lint + format 설정
├── package.json
├── tsconfig.json
├── bunfig.toml
├── .gitignore
├── .husky/
│   └── pre-commit                    # Biome check 실행
├── .github/
│   └── workflows/
│       ├── ci.yml                    # PR/push 시 lint + test
│       └── deploy-docs.yml           # docs-site → GitHub Pages 자동 배포
└── docs-site/                        # Astro + Starlight 문서 사이트
    ├── astro.config.mjs
    ├── package.json
    └── src/content/docs/
        ├── getting-started/
        ├── guides/
        └── reference/

# 사용하는 프로젝트에 생성되는 구조 (git 커밋 권장)
my-project/
└── .relay/
    ├── memory/
    │   ├── project.md                # 프로젝트 전체 요약 (init이 생성)
    │   ├── lessons.md                # 팀 공유 회고 및 의사결정 히스토리
    │   └── agents/
    │       ├── pm.md                 # PM 전용 기억
    │       ├── fe.md                 # FE 전용 기억
    │       ├── be.md                 # BE 전용 기억
    │       ├── da.md                 # DA 전용 기억
    │       ├── designer.md           # Designer 전용 기억
    │       └── qa.md                 # QA 전용 기억
    └── sessions/                     # 세션별 감사 로그 (SQLite → JSON export)
        └── YYYY-MM-DD-NNN/
            ├── messages.json
            ├── tasks.json
            └── summary.md

# 참고: .relay/memory/agents/ 에는 7개 에이전트 전용 파일이 생성됨
# pm.md, fe.md, be.md, da.md, designer.md, qa.md, deployer.md
```

---

## Chunk 1: 프로젝트 초기 설정 + DB 스키마

### Task 1: 프로젝트 초기화 및 패키지 설치

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `bunfig.toml`
- Create: `.gitignore`

- [ ] **Step 1: bun init**

```bash
cd /path/to/relay
bun init -y
```

- [ ] **Step 1b: package.json 핵심 필드 설정**

`bun init`이 생성한 `package.json`에 패키지 이름, 버전, 레포 정보를 설정한다:

```json
{
  "name": "@custardcream/relay",
  "version": "0.1.0",
  "description": "Claude Code 위에서 동작하는 멀티 에이전트 협업 프레임워크",
  "repository": {
    "type": "git",
    "url": "https://github.com/custardcream98/relay.git"
  },
  "homepage": "https://custardcream98.github.io/relay",
  "license": "MIT"
}
```

- [ ] **Step 2: 의존성 설치**

```bash
bun add @modelcontextprotocol/sdk hono zod
bun add -d typescript @types/bun
```

- [ ] **Step 2b: bunfig.toml 작성**

`bun init`은 `bunfig.toml`을 자동 생성하지 않으므로 수동으로 작성:

```toml
# bunfig.toml
[test]
# 필요 시 테스트 프리로드 설정
# preload = ["./test-setup.ts"]
```

- [ ] **Step 3: tsconfig.json 작성**

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "skipLibCheck": true,
    "types": ["bun-types"]
  },
  "include": ["src/**/*", "shared/**/*"]
}
```

- [ ] **Step 4: .gitignore 작성**

```
node_modules/
dist/
*.db
*.db-shm
*.db-wal
.env
```

- [ ] **Step 5: Commit**

```bash
git add package.json tsconfig.json bunfig.toml .gitignore
git commit -m "chore: 프로젝트 초기 설정"
```

---

### Task 2: DB 클라이언트 + 스키마

**Files:**
- Create: `src/db/client.ts`
- Create: `src/db/schema.ts`
- Test: `src/db/schema.test.ts`

- [ ] **Step 1: 테스트 먼저 작성**

```typescript
// src/db/schema.test.ts
import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { Database } from "bun:sqlite";
import { runMigrations } from "./schema";

describe("DB 스키마 마이그레이션", () => {
  let db: Database;

  beforeEach(() => {
    db = new Database(":memory:");
    runMigrations(db);
  });

  afterEach(() => db.close());

  test("messages 테이블 생성", () => {
    const row = db.query("SELECT name FROM sqlite_master WHERE type='table' AND name='messages'").get();
    expect(row).toBeTruthy();
  });

  test("tasks 테이블 생성", () => {
    const row = db.query("SELECT name FROM sqlite_master WHERE type='table' AND name='tasks'").get();
    expect(row).toBeTruthy();
  });

  test("artifacts 테이블 생성", () => {
    const row = db.query("SELECT name FROM sqlite_master WHERE type='table' AND name='artifacts'").get();
    expect(row).toBeTruthy();
  });

  test("reviews 테이블 생성", () => {
    const row = db.query("SELECT name FROM sqlite_master WHERE type='table' AND name='reviews'").get();
    expect(row).toBeTruthy();
  });

  test("events 테이블 생성", () => {
    const row = db.query("SELECT name FROM sqlite_master WHERE type='table' AND name='events'").get();
    expect(row).toBeTruthy();
  });
});
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

```bash
bun test src/db/schema.test.ts
```
Expected: FAIL (모듈 없음)

- [ ] **Step 3: 스키마 구현**

```typescript
// src/db/schema.ts
import type { Database } from "bun:sqlite";

export function runMigrations(db: Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      from_agent TEXT NOT NULL,
      to_agent TEXT,           -- NULL이면 브로드캐스트
      content TEXT NOT NULL,
      thread_id TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      assignee TEXT,
      status TEXT NOT NULL DEFAULT 'todo',  -- todo | in_progress | in_review | done
      priority TEXT NOT NULL DEFAULT 'medium',
      created_by TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS artifacts (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,     -- figma_spec | pr | report | design | analytics_plan
      content TEXT NOT NULL,
      created_by TEXT NOT NULL,
      task_id TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      artifact_id TEXT NOT NULL,
      reviewer TEXT NOT NULL,
      requester TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',  -- pending | approved | changes_requested
      comments TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      type TEXT NOT NULL,
      agent_id TEXT,
      payload TEXT NOT NULL,   -- JSON
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
  `);
}

export function dropAllTables(db: Database): void {
  db.exec(`
    DROP TABLE IF EXISTS messages;
    DROP TABLE IF EXISTS tasks;
    DROP TABLE IF EXISTS artifacts;
    DROP TABLE IF EXISTS reviews;
    DROP TABLE IF EXISTS events;
  `);
}
```

- [ ] **Step 4: DB 클라이언트 싱글톤 구현**

```typescript
// src/db/client.ts
import { Database } from "bun:sqlite";
import { runMigrations } from "./schema";

let _db: Database | null = null;

export function getDb(): Database {
  if (!_db) {
    const path = process.env.DB_PATH ?? "relay.db";
    _db = new Database(path);
    _db.exec("PRAGMA journal_mode = WAL;");
    runMigrations(_db);
  }
  return _db;
}

export function closeDb(): void {
  _db?.close();
  _db = null;
}
```

- [ ] **Step 5: 테스트 통과 확인**

```bash
bun test src/db/schema.test.ts
```
Expected: PASS (5개 테스트)

- [ ] **Step 6: Commit**

```bash
git add src/db/
git commit -m "feat: DB 스키마 및 클라이언트 구현"
```

---

### Task 3: MCP 서버 뼈대

**Files:**
- Create: `src/mcp.ts`
- Create: `src/index.ts`

- [ ] **Step 1: MCP 서버 뼈대 작성**

```typescript
// src/mcp.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: "relay",
    version: "0.1.0",
  });

  // 툴은 각 Task에서 등록
  return server;
}

export async function startMcpServer(server: McpServer): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[relay] MCP 서버 시작됨 (stdio)");
}
```

- [ ] **Step 2: 진입점 작성**

```typescript
// src/index.ts
import { createMcpServer, startMcpServer } from "./mcp";

const server = createMcpServer();
await startMcpServer(server);
```

- [ ] **Step 3: 실행 확인**

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1"}}}' | bun run src/index.ts
```
Expected: JSON-RPC 응답 (result.serverInfo.name === "relay")

- [ ] **Step 4: package.json scripts 추가**

```json
{
  "scripts": {
    "dev": "bun run --watch src/index.ts",
    "start": "bun run src/index.ts",
    "test": "bun test"
  }
}
```

- [ ] **Step 5: Commit**

```bash
git add src/
git commit -m "feat: MCP 서버 뼈대 구현"
```

---

## 환경변수 참조

| 변수 | 기본값 | 설명 |
|---|---|---|
| `RELAY_SESSION_ID` | `"default"` | 현재 세션 ID. `/relay` 스킬이 `YYYY-MM-DD-NNN` 형식으로 설정 |
| `DB_PATH` | `"relay.db"` | SQLite DB 파일 경로 |
| `RELAY_DIR` | `process.cwd() + "/.relay"` | 메모리·세션 저장 디렉토리 (사용자 프로젝트 루트) |
| `DASHBOARD_PORT` | `3456` | 대시보드 HTTP/WebSocket 포트 |
| `RELAY_DASHBOARD_PORT` | `3456` | PostToolUse 훅이 사용하는 포트 (DASHBOARD_PORT와 동일하게 설정) |

---

## Chunk 2: MCP 툴 — 메시징 & 태스크

### Task 4: 메시지 CRUD 쿼리

**Files:**
- Create: `src/db/queries/messages.ts`
- Test: `src/db/queries/messages.test.ts`

- [ ] **Step 1: 테스트 작성**

```typescript
// src/db/queries/messages.test.ts
import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { Database } from "bun:sqlite";
import { runMigrations } from "../schema";
import { insertMessage, getMessagesForAgent } from "./messages";

describe("메시지 쿼리", () => {
  let db: Database;

  beforeEach(() => {
    db = new Database(":memory:");
    runMigrations(db);
  });

  afterEach(() => db.close());

  test("메시지 삽입 및 조회", () => {
    insertMessage(db, {
      id: "msg-1",
      session_id: "sess-1",
      from_agent: "pm",
      to_agent: "fe",
      content: "PR 리뷰 부탁해",
      thread_id: null,
    });

    const msgs = getMessagesForAgent(db, "sess-1", "fe");
    expect(msgs).toHaveLength(1);
    expect(msgs[0].content).toBe("PR 리뷰 부탁해");
  });

  test("브로드캐스트 메시지 (to_agent=null) 전체 조회", () => {
    insertMessage(db, {
      id: "msg-2",
      session_id: "sess-1",
      from_agent: "pm",
      to_agent: null,
      content: "전체 공지",
      thread_id: null,
    });

    // 어느 에이전트든 브로드캐스트 수신
    const msgs = getMessagesForAgent(db, "sess-1", "fe");
    expect(msgs.some(m => m.id === "msg-2")).toBe(true);
  });
});
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

```bash
bun test src/db/queries/messages.test.ts
```

- [ ] **Step 3: 구현**

```typescript
// src/db/queries/messages.ts
import type { Database } from "bun:sqlite";

export interface MessageRow {
  id: string;
  session_id: string;
  from_agent: string;
  to_agent: string | null;
  content: string;
  thread_id: string | null;
  created_at: number;
}

export function insertMessage(db: Database, msg: Omit<MessageRow, "created_at">): void {
  db.query(`
    INSERT INTO messages (id, session_id, from_agent, to_agent, content, thread_id)
    VALUES ($id, $session_id, $from_agent, $to_agent, $content, $thread_id)
  `).run(msg);
}

export function getMessagesForAgent(
  db: Database,
  sessionId: string,
  agentId: string
): MessageRow[] {
  return db.query<MessageRow, [string, string]>(`
    SELECT * FROM messages
    WHERE session_id = ?
      AND (to_agent = ? OR to_agent IS NULL)
    ORDER BY created_at ASC
  `).all(sessionId, agentId) as MessageRow[];
}

export function getAllMessages(db: Database, sessionId: string): MessageRow[] {
  return db.query<MessageRow, [string]>(`
    SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC
  `).all(sessionId) as MessageRow[];
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
bun test src/db/queries/messages.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/db/queries/messages.ts src/db/queries/messages.test.ts
git commit -m "feat: 메시지 DB 쿼리 구현"
```

---

### Task 5: send_message / get_messages MCP 툴

**Files:**
- Create: `src/tools/messaging.ts`
- Test: `src/tools/messaging.test.ts`
- Modify: `src/mcp.ts`

- [ ] **Step 1: 테스트 작성**

```typescript
// src/tools/messaging.test.ts
import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { Database } from "bun:sqlite";
import { runMigrations } from "../db/schema";
import { handleSendMessage, handleGetMessages } from "./messaging";

describe("messaging 툴", () => {
  let db: Database;

  beforeEach(() => {
    db = new Database(":memory:");
    runMigrations(db);
  });

  afterEach(() => db.close());

  test("send_message: 메시지 전송 성공", async () => {
    const result = await handleSendMessage(db, "sess-1", {
      agent_id: "pm",
      to: "fe",
      content: "PR 리뷰 부탁해요",
    });
    expect(result.success).toBe(true);
    expect(result.message_id).toBeDefined();
  });

  test("get_messages: 수신 메시지 조회", async () => {
    await handleSendMessage(db, "sess-1", { agent_id: "pm", to: "fe", content: "안녕" });
    const result = await handleGetMessages(db, "sess-1", { agent_id: "fe" });
    expect(result.success).toBe(true);
    expect(result.messages).toHaveLength(1);
    expect(result.messages[0].from_agent).toBe("pm");
  });

  test("get_messages: 다른 에이전트 메시지는 조회 안 됨", async () => {
    await handleSendMessage(db, "sess-1", { agent_id: "pm", to: "be", content: "BE에게만" });
    const result = await handleGetMessages(db, "sess-1", { agent_id: "fe" });
    // FE는 BE로 보낸 메시지를 못 봄
    expect(result.messages.filter(m => m.to_agent === "be")).toHaveLength(0);
  });
});
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

```bash
bun test src/tools/messaging.test.ts
```

- [ ] **Step 3: 툴 핸들러 구현**

```typescript
// src/tools/messaging.ts
import type { Database } from "bun:sqlite";
import { insertMessage, getMessagesForAgent } from "../db/queries/messages";
import { randomUUID } from "crypto";

interface SendMessageInput {
  agent_id: string;
  to: string | null;
  content: string;
  thread_id?: string;
}

interface GetMessagesInput {
  agent_id: string;
}

export async function handleSendMessage(
  db: Database,
  sessionId: string,
  input: SendMessageInput
) {
  const id = randomUUID();
  insertMessage(db, {
    id,
    session_id: sessionId,
    from_agent: input.agent_id,
    to_agent: input.to ?? null,
    content: input.content,
    thread_id: input.thread_id ?? null,
  });
  return { success: true, message_id: id };
}

export async function handleGetMessages(
  db: Database,
  sessionId: string,
  input: GetMessagesInput
) {
  const messages = getMessagesForAgent(db, sessionId, input.agent_id);
  return { success: true, messages };
}
```

- [ ] **Step 4: mcp.ts에 툴 등록**

```typescript
// src/mcp.ts 에 추가
import { z } from "zod";
import { handleSendMessage, handleGetMessages } from "./tools/messaging";
import { getDb } from "./db/client";

// createMcpServer() 안에:
const SESSION_ID = process.env.RELAY_SESSION_ID ?? "default";

server.tool("send_message", {
  agent_id: z.string().describe("보내는 에이전트 ID (예: pm, fe, be, qa)"),
  to: z.string().nullable().describe("받는 에이전트 ID. null이면 브로드캐스트"),
  content: z.string().describe("메시지 내용"),
  thread_id: z.string().optional().describe("스레드 ID (선택)"),
}, async (input) => {
  const result = await handleSendMessage(getDb(), SESSION_ID, input);
  return { content: [{ type: "text", text: JSON.stringify(result) }] };
});

server.tool("get_messages", {
  agent_id: z.string().describe("조회할 에이전트 ID"),
}, async (input) => {
  const result = await handleGetMessages(getDb(), SESSION_ID, input);
  return { content: [{ type: "text", text: JSON.stringify(result) }] };
});
```

- [ ] **Step 5: 테스트 통과 확인**

```bash
bun test src/tools/messaging.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add src/tools/messaging.ts src/tools/messaging.test.ts src/mcp.ts
git commit -m "feat: send_message / get_messages MCP 툴 구현"
```

---

### Task 6: 태스크 CRUD 쿼리

**Files:**
- Create: `src/db/queries/tasks.ts`
- Test: `src/db/queries/tasks.test.ts`

- [ ] **Step 1: 테스트 작성**

```typescript
// src/db/queries/tasks.test.ts
import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { Database } from "bun:sqlite";
import { runMigrations } from "../schema";
import { insertTask, updateTask, getTasksByAssignee, getTaskById } from "./tasks";

describe("태스크 쿼리", () => {
  let db: Database;

  beforeEach(() => {
    db = new Database(":memory:");
    runMigrations(db);
  });

  afterEach(() => db.close());

  test("태스크 생성 및 ID 조회", () => {
    insertTask(db, {
      id: "task-1",
      session_id: "sess-1",
      title: "로그인 UI 구현",
      description: "OAuth 로그인 버튼 추가",
      assignee: "fe",
      status: "todo",
      priority: "high",
      created_by: "pm",
    });

    const task = getTaskById(db, "task-1");
    expect(task?.title).toBe("로그인 UI 구현");
    expect(task?.status).toBe("todo");
  });

  test("태스크 상태 업데이트", () => {
    insertTask(db, {
      id: "task-2",
      session_id: "sess-1",
      title: "API 설계",
      description: null,
      assignee: "be",
      status: "todo",
      priority: "medium",
      created_by: "pm",
    });

    updateTask(db, "task-2", { status: "in_progress" });
    const task = getTaskById(db, "task-2");
    expect(task?.status).toBe("in_progress");
  });

  test("담당자별 태스크 조회", () => {
    insertTask(db, { id: "t1", session_id: "s1", title: "FE 작업", description: null, assignee: "fe", status: "todo", priority: "medium", created_by: "pm" });
    insertTask(db, { id: "t2", session_id: "s1", title: "BE 작업", description: null, assignee: "be", status: "todo", priority: "medium", created_by: "pm" });

    const feTasks = getTasksByAssignee(db, "s1", "fe");
    expect(feTasks).toHaveLength(1);
    expect(feTasks[0].title).toBe("FE 작업");
  });

  test("updateTask: 빈 updates 전달 시 에러 없이 종료 (SQL 오류 방지)", () => {
    insertTask(db, {
      id: "task-3",
      session_id: "sess-1",
      title: "빈 업데이트 테스트",
      description: null,
      assignee: "fe",
      status: "todo",
      priority: "medium",
      created_by: "pm",
    });
    // 빈 updates → SQL "SET , updated_at = ..." 오류 없이 통과해야 함
    expect(() => updateTask(db, "task-3", {})).not.toThrow();
  });
});
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

```bash
bun test src/db/queries/tasks.test.ts
```

- [ ] **Step 3: 구현**

```typescript
// src/db/queries/tasks.ts
import type { Database } from "bun:sqlite";

export interface TaskRow {
  id: string;
  session_id: string;
  title: string;
  description: string | null;
  assignee: string | null;
  status: string;
  priority: string;
  created_by: string;
  created_at: number;
  updated_at: number;
}

export function insertTask(db: Database, task: Omit<TaskRow, "created_at" | "updated_at">): void {
  db.query(`
    INSERT INTO tasks (id, session_id, title, description, assignee, status, priority, created_by)
    VALUES ($id, $session_id, $title, $description, $assignee, $status, $priority, $created_by)
  `).run(task);
}

export function updateTask(
  db: Database,
  id: string,
  updates: Partial<Pick<TaskRow, "status" | "assignee" | "description">>
): void {
  // updates가 비어 있으면 SQL이 "SET , updated_at = ..."이 되어 syntax error 발생
  if (Object.keys(updates).length === 0) return;
  const fields = Object.keys(updates)
    .map(k => `${k} = $${k}`)
    .join(", ");
  db.query(`
    UPDATE tasks SET ${fields}, updated_at = unixepoch() WHERE id = $id
  `).run({ ...updates, id });
}

export function getTaskById(db: Database, id: string): TaskRow | null {
  return db.query<TaskRow, [string]>("SELECT * FROM tasks WHERE id = ?").get(id) ?? null;
}

export function getTasksByAssignee(db: Database, sessionId: string, assignee: string): TaskRow[] {
  return db.query<TaskRow, [string, string]>(
    "SELECT * FROM tasks WHERE session_id = ? AND assignee = ? ORDER BY created_at ASC"
  ).all(sessionId, assignee);
}

export function getAllTasks(db: Database, sessionId: string): TaskRow[] {
  return db.query<TaskRow, [string]>(
    "SELECT * FROM tasks WHERE session_id = ? ORDER BY created_at ASC"
  ).all(sessionId);
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
bun test src/db/queries/tasks.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/db/queries/tasks.ts src/db/queries/tasks.test.ts
git commit -m "feat: 태스크 DB 쿼리 구현"
```

---

### Task 7: create_task / update_task / get_my_tasks MCP 툴

**Files:**
- Create: `src/tools/tasks.ts`
- Test: `src/tools/tasks.test.ts`
- Modify: `src/mcp.ts`

- [ ] **Step 1: 테스트 작성**

```typescript
// src/tools/tasks.test.ts
import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { Database } from "bun:sqlite";
import { runMigrations } from "../db/schema";
import { handleCreateTask, handleUpdateTask, handleGetMyTasks } from "./tasks";

describe("tasks 툴", () => {
  let db: Database;

  beforeEach(() => {
    db = new Database(":memory:");
    runMigrations(db);
  });

  afterEach(() => db.close());

  test("create_task: 태스크 생성", async () => {
    const result = await handleCreateTask(db, "sess-1", {
      agent_id: "pm",
      title: "쇼핑카트 API 설계",
      description: "REST API 엔드포인트 명세 작성",
      assignee: "be",
      priority: "high",
    });
    expect(result.success).toBe(true);
    expect(result.task_id).toBeDefined();
  });

  test("update_task: 상태 변경", async () => {
    const { task_id } = await handleCreateTask(db, "sess-1", {
      agent_id: "pm", title: "테스트", assignee: "fe", priority: "medium",
    });
    const result = await handleUpdateTask(db, "sess-1", {
      agent_id: "fe",
      task_id: task_id!,
      status: "in_progress",
    });
    expect(result.success).toBe(true);
  });

  test("get_my_tasks: 내 태스크만 조회", async () => {
    await handleCreateTask(db, "sess-1", { agent_id: "pm", title: "FE 작업", assignee: "fe", priority: "low" });
    await handleCreateTask(db, "sess-1", { agent_id: "pm", title: "BE 작업", assignee: "be", priority: "low" });

    const result = await handleGetMyTasks(db, "sess-1", { agent_id: "fe" });
    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0].title).toBe("FE 작업");
  });
});
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

```bash
bun test src/tools/tasks.test.ts
```

- [ ] **Step 3: 구현**

```typescript
// src/tools/tasks.ts
import type { Database } from "bun:sqlite";
import { insertTask, updateTask, getTasksByAssignee } from "../db/queries/tasks";
import type { TaskRow } from "../db/queries/tasks";
import { randomUUID } from "crypto";

export async function handleCreateTask(
  db: Database,
  sessionId: string,
  input: { agent_id: string; title: string; description?: string; assignee?: string; priority: string }
) {
  const id = randomUUID();
  insertTask(db, {
    id,
    session_id: sessionId,
    title: input.title,
    description: input.description ?? null,
    assignee: input.assignee ?? null,
    status: "todo",
    priority: input.priority,
    created_by: input.agent_id,
  });
  return { success: true, task_id: id };
}

export async function handleUpdateTask(
  db: Database,
  sessionId: string,
  input: { agent_id: string; task_id: string; status?: string; assignee?: string }
) {
  const updates: Partial<Pick<TaskRow, "status" | "assignee" | "description">> = {};
  if (input.status !== undefined) updates.status = input.status;
  if (input.assignee !== undefined) updates.assignee = input.assignee;
  updateTask(db, input.task_id, updates);
  return { success: true };
}

export async function handleGetMyTasks(
  db: Database,
  sessionId: string,
  input: { agent_id: string }
) {
  const tasks = getTasksByAssignee(db, sessionId, input.agent_id);
  return { success: true, tasks };
}
```

- [ ] **Step 4: mcp.ts에 툴 등록**

```typescript
// src/mcp.ts 에 추가
import { handleCreateTask, handleUpdateTask, handleGetMyTasks } from "./tools/tasks";

server.tool("create_task", {
  agent_id: z.string().describe("태스크를 생성하는 에이전트 ID"),
  title: z.string().describe("태스크 제목"),
  description: z.string().optional().describe("상세 설명 및 완료 기준"),
  assignee: z.string().optional().describe("담당 에이전트 ID"),
  priority: z.enum(["critical", "high", "medium", "low"]).describe("우선순위"),
}, async (input) => {
  const result = await handleCreateTask(getDb(), SESSION_ID, input);
  return { content: [{ type: "text", text: JSON.stringify(result) }] };
});

server.tool("update_task", {
  agent_id: z.string().describe("업데이트하는 에이전트 ID"),
  task_id: z.string().describe("업데이트할 태스크 ID"),
  status: z.enum(["todo", "in_progress", "in_review", "done"]).optional().describe("새 상태"),
  assignee: z.string().optional().describe("새 담당자"),
}, async (input) => {
  const result = await handleUpdateTask(getDb(), SESSION_ID, input);
  return { content: [{ type: "text", text: JSON.stringify(result) }] };
});

server.tool("get_my_tasks", {
  agent_id: z.string().describe("조회할 에이전트 ID"),
}, async (input) => {
  const result = await handleGetMyTasks(getDb(), SESSION_ID, input);
  return { content: [{ type: "text", text: JSON.stringify(result) }] };
});
```

- [ ] **Step 5: 테스트 통과 확인**

```bash
bun test src/tools/tasks.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add src/tools/tasks.ts src/tools/tasks.test.ts src/mcp.ts
git commit -m "feat: create_task / update_task / get_my_tasks MCP 툴 구현"
```

---

## Chunk 3: MCP 툴 — 아티팩트 & 리뷰

### Task 8: 아티팩트 쿼리 + post_artifact / get_artifact 툴

**Files:**
- Create: `src/db/queries/artifacts.ts`
- Test: `src/db/queries/artifacts.test.ts`
- Create: `src/tools/artifacts.ts`
- Test: `src/tools/artifacts.test.ts`
- Modify: `src/mcp.ts`

- [ ] **Step 1: 아티팩트 DB 쿼리 테스트 작성 + 실패 확인**

```typescript
// src/db/queries/artifacts.test.ts
import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { Database } from "bun:sqlite";
import { runMigrations } from "../schema";
import { insertArtifact, getArtifactByName } from "./artifacts";

describe("아티팩트 쿼리", () => {
  let db: Database;
  beforeEach(() => { db = new Database(":memory:"); runMigrations(db); });
  afterEach(() => db.close());

  test("아티팩트 저장 및 이름으로 조회", () => {
    insertArtifact(db, {
      id: "art-1",
      session_id: "sess-1",
      name: "login-design",
      type: "figma_spec",
      content: JSON.stringify({ screens: ["login", "signup"] }),
      created_by: "designer",
      task_id: "task-1",
    });
    const art = getArtifactByName(db, "sess-1", "login-design");
    expect(art?.type).toBe("figma_spec");
  });
});
```

- [ ] **Step 2: 아티팩트 DB 쿼리 구현 + 테스트 통과**

```typescript
// src/db/queries/artifacts.ts
import type { Database } from "bun:sqlite";

export interface ArtifactRow {
  id: string; session_id: string; name: string; type: string;
  content: string; created_by: string; task_id: string | null; created_at: number;
}

export function insertArtifact(db: Database, artifact: Omit<ArtifactRow, "created_at">): void {
  db.query(`
    INSERT INTO artifacts (id, session_id, name, type, content, created_by, task_id)
    VALUES ($id, $session_id, $name, $type, $content, $created_by, $task_id)
  `).run(artifact);
}

export function getArtifactByName(db: Database, sessionId: string, name: string): ArtifactRow | null {
  return db.query<ArtifactRow, [string, string]>(
    "SELECT * FROM artifacts WHERE session_id = ? AND name = ? ORDER BY created_at DESC LIMIT 1"
  ).get(sessionId, name) ?? null;
}

export function getAllArtifacts(db: Database, sessionId: string): ArtifactRow[] {
  return db.query<ArtifactRow, [string]>(
    "SELECT * FROM artifacts WHERE session_id = ? ORDER BY created_at ASC"
  ).all(sessionId);
}
```

- [ ] **Step 3: post_artifact / get_artifact 툴 핸들러 + 테스트 작성 및 통과**

```typescript
// src/tools/artifacts.test.ts
import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { Database } from "bun:sqlite";
import { runMigrations } from "../db/schema";
import { handlePostArtifact, handleGetArtifact } from "./artifacts";

describe("artifacts 툴", () => {
  let db: Database;
  beforeEach(() => { db = new Database(":memory:"); runMigrations(db); });
  afterEach(() => db.close());

  test("post_artifact: 아티팩트 저장", async () => {
    const result = await handlePostArtifact(db, "sess-1", {
      agent_id: "designer",
      name: "login-design",
      type: "figma_spec",
      content: JSON.stringify({ screens: ["login"] }),
      task_id: "task-1",
    });
    expect(result.success).toBe(true);
    expect(result.artifact_id).toBeDefined();
  });

  test("get_artifact: 이름으로 조회", async () => {
    await handlePostArtifact(db, "sess-1", {
      agent_id: "designer", name: "login-design", type: "figma_spec",
      content: "{}",
    });
    const result = await handleGetArtifact(db, "sess-1", { agent_id: "fe", name: "login-design" });
    expect(result.success).toBe(true);
    expect(result.artifact?.type).toBe("figma_spec");
  });
});
```

```typescript
// src/tools/artifacts.ts
import type { Database } from "bun:sqlite";
import { insertArtifact, getArtifactByName } from "../db/queries/artifacts";
import { randomUUID } from "crypto";

export async function handlePostArtifact(
  db: Database,
  sessionId: string,
  input: { agent_id: string; name: string; type: string; content: string; task_id?: string }
) {
  const id = randomUUID();
  insertArtifact(db, {
    id,
    session_id: sessionId,
    name: input.name,
    type: input.type,
    content: input.content,
    created_by: input.agent_id,
    task_id: input.task_id ?? null,
  });
  return { success: true, artifact_id: id };
}

export async function handleGetArtifact(
  db: Database,
  sessionId: string,
  input: { agent_id: string; name: string }
) {
  const artifact = getArtifactByName(db, sessionId, input.name);
  if (!artifact) return { success: false, artifact: null, error: "아티팩트를 찾을 수 없습니다" };
  return { success: true, artifact };
}
```

- [ ] **Step 4: mcp.ts에 툴 등록**

```typescript
// src/mcp.ts 에 추가
import { handlePostArtifact, handleGetArtifact } from "./tools/artifacts";

server.tool("post_artifact", {
  agent_id: z.string().describe("아티팩트를 올리는 에이전트 ID"),
  name: z.string().describe("아티팩트 이름 (예: login-design, cart-fe-pr)"),
  type: z.enum(["figma_spec", "pr", "report", "analytics_plan", "design"]).describe("아티팩트 종류"),
  content: z.string().describe("아티팩트 내용 (JSON 또는 Markdown)"),
  task_id: z.string().optional().describe("연관 태스크 ID"),
}, async (input) => {
  const result = await handlePostArtifact(getDb(), SESSION_ID, input);
  return { content: [{ type: "text", text: JSON.stringify(result) }] };
});

server.tool("get_artifact", {
  agent_id: z.string().describe("조회하는 에이전트 ID"),
  name: z.string().describe("조회할 아티팩트 이름"),
}, async (input) => {
  const result = await handleGetArtifact(getDb(), SESSION_ID, input);
  return { content: [{ type: "text", text: JSON.stringify(result) }] };
});
```

- [ ] **Step 5: 테스트 통과 확인**

```bash
bun test src/tools/artifacts.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add src/db/queries/artifacts.ts src/db/queries/artifacts.test.ts src/tools/artifacts.ts src/tools/artifacts.test.ts src/mcp.ts
git commit -m "feat: post_artifact / get_artifact MCP 툴 구현"
```

---

### Task 9: 리뷰 쿼리 + request_review / submit_review 툴

**Files:**
- Create: `src/db/queries/reviews.ts`
- Test: `src/db/queries/reviews.test.ts`
- Create: `src/tools/review.ts`
- Test: `src/tools/review.test.ts`
- Modify: `src/mcp.ts`

- [ ] **Step 1: 리뷰 DB 쿼리 테스트 작성 + 실패 확인**

```typescript
// src/db/queries/reviews.test.ts
import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { Database } from "bun:sqlite";
import { runMigrations } from "../schema";
import { insertReview, updateReviewStatus, getReviewsByReviewer } from "./reviews";

describe("리뷰 쿼리", () => {
  let db: Database;
  beforeEach(() => { db = new Database(":memory:"); runMigrations(db); });
  afterEach(() => db.close());

  test("리뷰 요청 생성", () => {
    insertReview(db, {
      id: "rev-1", session_id: "sess-1",
      artifact_id: "art-1", reviewer: "be", requester: "fe",
      status: "pending", comments: null,
    });
    const reviews = getReviewsByReviewer(db, "sess-1", "be");
    expect(reviews).toHaveLength(1);
  });

  test("리뷰 상태 업데이트", () => {
    insertReview(db, {
      id: "rev-2", session_id: "sess-1",
      artifact_id: "art-1", reviewer: "be2", requester: "fe",
      status: "pending", comments: null,
    });
    updateReviewStatus(db, "rev-2", "approved", "LGTM!");
    const reviews = getReviewsByReviewer(db, "sess-1", "be2");
    expect(reviews[0].status).toBe("approved");
    expect(reviews[0].comments).toBe("LGTM!");
  });
});
```

- [ ] **Step 2: reviews.ts DB 쿼리 구현**

```typescript
// src/db/queries/reviews.ts
import type { Database } from "bun:sqlite";

export interface ReviewRow {
  id: string;
  session_id: string;
  artifact_id: string;
  reviewer: string;
  requester: string;
  status: string;
  comments: string | null;
  created_at: number;
  updated_at: number;
}

export function insertReview(db: Database, review: Omit<ReviewRow, "created_at" | "updated_at">): void {
  db.query(`
    INSERT INTO reviews (id, session_id, artifact_id, reviewer, requester, status, comments)
    VALUES ($id, $session_id, $artifact_id, $reviewer, $requester, $status, $comments)
  `).run(review);
}

export function updateReviewStatus(db: Database, id: string, status: string, comments: string | null): void {
  db.query(`
    UPDATE reviews SET status = $status, comments = $comments, updated_at = unixepoch()
    WHERE id = $id
  `).run({ id, status, comments });
}

export function getReviewsByReviewer(db: Database, sessionId: string, reviewer: string): ReviewRow[] {
  return db.query<ReviewRow, [string, string]>(
    "SELECT * FROM reviews WHERE session_id = ? AND reviewer = ? ORDER BY created_at ASC"
  ).all(sessionId, reviewer);
}
```

- [ ] **Step 3: review.ts 툴 핸들러 + 테스트 작성 및 통과**

```typescript
// src/tools/review.test.ts
import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { Database } from "bun:sqlite";
import { runMigrations } from "../db/schema";
import { handleRequestReview, handleSubmitReview } from "./review";

describe("review 툴", () => {
  let db: Database;
  beforeEach(() => { db = new Database(":memory:"); runMigrations(db); });
  afterEach(() => db.close());

  test("request_review: 리뷰 요청 생성", async () => {
    const result = await handleRequestReview(db, "sess-1", {
      agent_id: "fe",
      artifact_id: "art-1",
      reviewer: "fe2",
    });
    expect(result.success).toBe(true);
    expect(result.review_id).toBeDefined();
  });

  test("submit_review: 리뷰 결과 제출", async () => {
    const { review_id } = await handleRequestReview(db, "sess-1", {
      agent_id: "fe", artifact_id: "art-1", reviewer: "fe2",
    });
    const result = await handleSubmitReview(db, "sess-1", {
      agent_id: "fe2",
      review_id: review_id!,
      status: "approved",
      comments: "LGTM! 코드가 깔끔합니다.",
    });
    expect(result.success).toBe(true);
  });
});
```

```typescript
// src/tools/review.ts
import type { Database } from "bun:sqlite";
import { insertReview, updateReviewStatus } from "../db/queries/reviews";
import { randomUUID } from "crypto";

export async function handleRequestReview(
  db: Database,
  sessionId: string,
  input: { agent_id: string; artifact_id: string; reviewer: string }
) {
  const id = randomUUID();
  insertReview(db, {
    id,
    session_id: sessionId,
    artifact_id: input.artifact_id,
    reviewer: input.reviewer,
    requester: input.agent_id,
    status: "pending",
    comments: null,
  });
  return { success: true, review_id: id };
}

export async function handleSubmitReview(
  db: Database,
  sessionId: string,
  input: { agent_id: string; review_id: string; status: "approved" | "changes_requested"; comments?: string }
) {
  updateReviewStatus(db, input.review_id, input.status, input.comments ?? null);
  return { success: true };
}
```

- [ ] **Step 4: mcp.ts에 툴 등록**

```typescript
// src/mcp.ts 에 추가
import { handleRequestReview, handleSubmitReview } from "./tools/review";

server.tool("request_review", {
  agent_id: z.string().describe("리뷰를 요청하는 에이전트 ID"),
  artifact_id: z.string().describe("리뷰 대상 아티팩트 ID"),
  reviewer: z.string().describe("리뷰어 에이전트 ID (예: fe2, be2)"),
}, async (input) => {
  const result = await handleRequestReview(getDb(), SESSION_ID, input);
  return { content: [{ type: "text", text: JSON.stringify(result) }] };
});

server.tool("submit_review", {
  agent_id: z.string().describe("리뷰를 제출하는 에이전트 ID"),
  review_id: z.string().describe("리뷰 ID"),
  status: z.enum(["approved", "changes_requested"]).describe("리뷰 결과"),
  comments: z.string().optional().describe("리뷰 코멘트"),
}, async (input) => {
  const result = await handleSubmitReview(getDb(), SESSION_ID, input);
  return { content: [{ type: "text", text: JSON.stringify(result) }] };
});
```

- [ ] **Step 5: 전체 툴 통합 테스트**

```bash
bun test
```
Expected: 전체 테스트 PASS

- [ ] **Step 6: Commit**

```bash
git add src/db/queries/reviews.ts src/db/queries/reviews.test.ts src/tools/review.ts src/tools/review.test.ts src/mcp.ts
git commit -m "feat: request_review / submit_review MCP 툴 구현"
```

---

## Chunk 4: 대시보드 백엔드 (Hono + WebSocket)

### Task 10: 이벤트 타입 정의 + WebSocket 브로드캐스터

**Files:**
- Create: `shared/types.ts`
- Create: `src/dashboard/events.ts`
- Create: `src/dashboard/websocket.ts`

- [ ] **Step 1: 공유 타입 정의 + RelayEvent 정의**

서버-대시보드가 같은 타입을 공유한다. 중복 없이 `shared/types.ts`에 한 번만 정의한다.

```typescript
// shared/types.ts
// AgentId는 string — 사용자가 agents.yml에 커스텀 에이전트를 추가할 수 있으므로 닫힌 유니온 불가
export type AgentId = string;

export type RelayEvent =
  | { type: "agent:thinking"; agentId: AgentId; chunk: string; timestamp: number }
  | { type: "agent:status"; agentId: AgentId; status: "idle" | "working" | "waiting"; timestamp: number }
  | { type: "message:new"; message: { id: string; from_agent: string; to_agent: string | null; content: string; thread_id: string | null; created_at: number }; timestamp: number }
  | { type: "task:updated"; task: { id: string; title: string; assignee: string | null; status: string; priority: string }; timestamp: number }
  | { type: "artifact:posted"; artifact: { id: string; name: string; type: string; created_by: string }; timestamp: number }
  | { type: "review:requested"; review: { id: string; artifact_id: string; reviewer: string; requester: string }; timestamp: number }
  | { type: "session:snapshot"; tasks: unknown[]; messages: unknown[]; artifacts: unknown[]; timestamp: number };
```

```typescript
// src/dashboard/events.ts — shared/types.ts에서 re-export
export type { AgentId, RelayEvent } from "../../shared/types";
```

- [ ] **Step 2: WebSocket 브로드캐스터 구현**

```typescript
// src/dashboard/websocket.ts
import type { ServerWebSocket } from "bun";
import type { RelayEvent } from "./events";

// 연결된 클라이언트 집합
const clients = new Set<ServerWebSocket<unknown>>();

export function addClient(ws: ServerWebSocket<unknown>): void {
  clients.add(ws);
}

export function removeClient(ws: ServerWebSocket<unknown>): void {
  clients.delete(ws);
}

export function broadcast(event: RelayEvent): void {
  const payload = JSON.stringify(event);
  for (const client of clients) {
    try {
      client.send(payload);
    } catch {
      clients.delete(client);
    }
  }
}
```

- [ ] **Step 3: `messaging.ts` — `handleSendMessage` 반환값 확장**

broadcast 시 전체 메시지 객체가 필요하므로, Task 5에서 작성한 `handleSendMessage`를 수정한다.
(Task 5 테스트는 `message_id`만 검사하므로 여전히 통과)

```typescript
// src/tools/messaging.ts — handleSendMessage 반환값 수정
export async function handleSendMessage(
  db: Database,
  sessionId: string,
  input: SendMessageInput
) {
  const id = randomUUID();
  const msg = {
    id,
    session_id: sessionId,
    from_agent: input.agent_id,
    to_agent: input.to ?? null,
    content: input.content,
    thread_id: input.thread_id ?? null,
  };
  insertMessage(db, msg);
  // DB는 unixepoch()(초) 사용 — broadcast용 created_at도 초 단위로 통일
  return { success: true, message_id: id, message: { ...msg, created_at: Math.floor(Date.now() / 1000) } };
}
```

- [ ] **Step 4: mcp.ts 툴 등록부에서 broadcast 호출 연결**

순환 참조를 피하기 위해 각 tool 핸들러 자체는 broadcast를 호출하지 않는다.
대신 `src/mcp.ts`의 툴 등록 시 handler 호출 후 broadcast를 이어서 호출한다:

```typescript
// src/mcp.ts 에서 (send_message 등록 예시)
import { broadcast } from "./dashboard/websocket";

server.tool("send_message", { /* ... */ }, async (input) => {
  const result = await handleSendMessage(getDb(), SESSION_ID, input);
  if (result.success) {
    broadcast({
      type: "message:new",
      message: result.message,  // Step 3에서 수정된 반환값 사용
      timestamp: Date.now(),
    });
  }
  return { content: [{ type: "text", text: JSON.stringify(result) }] };
});
```

각 툴 등록 시 handler 호출 후 broadcast를 이어서 호출한다. 전체 패턴:

```typescript
// src/mcp.ts — create_task
server.tool("create_task", { /* ... */ }, async (input) => {
  const result = await handleCreateTask(getDb(), SESSION_ID, input);
  if (result.success && result.task_id) {
    broadcast({ type: "task:updated",
      task: { id: result.task_id, title: input.title, assignee: input.assignee ?? null,
               status: "todo", priority: input.priority },
      timestamp: Date.now() });
  }
  return { content: [{ type: "text", text: JSON.stringify(result) }] };
});

// src/mcp.ts — update_task
server.tool("update_task", { /* ... */ }, async (input) => {
  const result = await handleUpdateTask(getDb(), SESSION_ID, input);
  if (result.success) {
    // DB에서 최신 task 조회하여 broadcast
    const task = getTaskById(getDb(), input.task_id);
    if (task) broadcast({ type: "task:updated",
      task: { id: task.id, title: task.title, assignee: task.assignee,
               status: task.status, priority: task.priority },
      timestamp: Date.now() });
  }
  return { content: [{ type: "text", text: JSON.stringify(result) }] };
});

// src/mcp.ts — post_artifact
server.tool("post_artifact", { /* ... */ }, async (input) => {
  const result = await handlePostArtifact(getDb(), SESSION_ID, input);
  if (result.success && result.artifact_id) {
    broadcast({ type: "artifact:posted",
      artifact: { id: result.artifact_id, name: input.name, type: input.type,
                  created_by: input.agent_id },
      timestamp: Date.now() });
  }
  return { content: [{ type: "text", text: JSON.stringify(result) }] };
});

// src/mcp.ts — request_review
server.tool("request_review", { /* ... */ }, async (input) => {
  const result = await handleRequestReview(getDb(), SESSION_ID, input);
  if (result.success && result.review_id) {
    broadcast({ type: "review:requested",
      review: { id: result.review_id, artifact_id: input.artifact_id,
                 reviewer: input.reviewer, requester: input.agent_id },
      timestamp: Date.now() });
  }
  return { content: [{ type: "text", text: JSON.stringify(result) }] };
});

// submit_review: 리뷰 상태 변경은 대시보드에 별도 이벤트 타입이 없으므로 broadcast 생략
```

`update_task` broadcast를 위해 `src/mcp.ts`에 `getTaskById` import 추가:
```typescript
import { getTaskById } from "./db/queries/tasks";
```

- [ ] **Step 5: Commit**

```bash
git add shared/types.ts src/dashboard/events.ts src/dashboard/websocket.ts src/mcp.ts src/tools/messaging.ts
git commit -m "feat: 공유 타입 + WebSocket 브로드캐스터 및 이벤트 타입 구현"
```

---

### Task 11: Hono REST API + 서버 통합

**Files:**
- Create: `src/dashboard/hono.ts`
- Modify: `src/index.ts`

- [ ] **Step 1: Hono 앱 구현**

```typescript
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
// CWD 기준 상대 경로는 MCP 서버가 사용자 프로젝트에서 실행될 때 틀리므로 절대 경로 사용
const RELAY_PKG_ROOT = join(import.meta.dir, "../..");
const DASHBOARD_DIST = join(RELAY_PKG_ROOT, "dashboard", "dist");

export const app = new Hono();

// 정적 파일 (빌드된 React 앱)
app.use("/assets/*", serveStatic({ root: DASHBOARD_DIST }));

// API: 에이전트 목록 (프론트엔드가 동적으로 에이전트 목록 표시하는 데 사용)
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
```

- [ ] **Step 2: index.ts에서 MCP + Hono + WebSocket 통합 기동**

```typescript
// src/index.ts
import { createMcpServer, startMcpServer } from "./mcp";
import { app } from "./dashboard/hono";
import { addClient, removeClient } from "./dashboard/websocket";

const DASHBOARD_PORT = Number(process.env.DASHBOARD_PORT ?? 3456);

// 대시보드 HTTP + WebSocket 서버
// Bun WebSocket은 fetch 핸들러에서 직접 server.upgrade()를 호출해야 작동함
Bun.serve({
  port: DASHBOARD_PORT,
  fetch(req, server) {
    const url = new URL(req.url);
    // /ws 경로는 WebSocket 업그레이드 처리
    if (url.pathname === "/ws") {
      if (server.upgrade(req)) return undefined;
      return new Response("WebSocket upgrade failed", { status: 400 });
    }
    return app.fetch(req);
  },
  websocket: {
    open(ws) { addClient(ws); },
    close(ws) { removeClient(ws); },
    message() {},  // 클라이언트 → 서버 메시지는 현재 미사용
  },
});

console.error(`[relay] 대시보드: http://localhost:${DASHBOARD_PORT}`);

// MCP 서버 (stdio)
const server = createMcpServer();
await startMcpServer(server);
```

- [ ] **Step 3: 서버 기동 확인**

```bash
RELAY_SESSION_ID=test bun run src/index.ts &
curl http://localhost:3456/api/session
```
Expected: `{"tasks":[],"messages":[],"artifacts":[]}`

- [ ] **Step 4: Commit**

```bash
git add src/dashboard/hono.ts src/index.ts
git commit -m "feat: Hono REST API + MCP + WebSocket 통합 서버 구현"
```

---

## Chunk 5: 에이전트 페르소나

### Task 12: 에이전트 타입 + YAML 기반 페르소나 설정

**Files:**
- Create: `src/agents/types.ts`
- Create: `src/agents/loader.ts`
- Test: `src/agents/loader.test.ts`
- Create: `agents.default.yml`
- Create: `agents.yml` (사용자 편집용 예시)
- Modify: `src/mcp.ts` (list_agents, get_workflow 툴 추가)

- [ ] **Step 1: 의존성 추가**

```bash
bun add js-yaml
bun add -d @types/js-yaml
```

- [ ] **Step 2: 에이전트 타입 정의**

```typescript
// src/agents/types.ts
export type AgentId = string; // 기본 제공: pm | designer | da | fe | be | qa | deployer
                               // 사용자가 agents.yml에 자유롭게 추가 가능

export interface AgentConfig {
  name: string;
  emoji: string;
  description?: string;
  tools: string[];         // 이 에이전트에게 허용할 MCP 툴 목록
  systemPrompt: string;
  disabled?: boolean;      // true면 이 에이전트 비활성화
  extends?: string;        // 다른 에이전트 설정 상속 후 오버라이드
}

export interface WorkflowJob {
  agents?: string[];                    // 이 job에서 실행할 에이전트 목록 (병렬 실행)
  description: string;                  // 자연어 job 설명. 에이전트 system prompt에 주입됨
  end?: Record<string, string>;        // { nextJobId: 자연어 조건 } — _done은 세션 종료
  reviewers?: Record<string, string[]>; // { 작업에이전트: [리뷰어 목록] }
}

export interface WorkflowConfig {
  jobs: Record<string, WorkflowJob>;
}

export interface AgentsFile {
  agents: Record<AgentId, Partial<AgentConfig>>;
  workflow?: WorkflowConfig;
}

// loader가 merge 후 반환하는 완성된 페르소나
export interface AgentPersona extends AgentConfig {
  id: AgentId;
}
```

- [ ] **Step 3: loader 테스트 작성**

```typescript
// src/agents/loader.test.ts
import { describe, test, expect } from "bun:test";
import { loadAgents, getWorkflow } from "./loader";
import type { AgentsFile } from "./types";

describe("에이전트 loader", () => {
  test("기본 agents.default.yml 로드 성공", () => {
    const agents = loadAgents();
    expect(agents.pm).toBeDefined();
    expect(agents.fe).toBeDefined();
    expect(agents.be).toBeDefined();
    expect(agents.qa).toBeDefined();
  });

  test("pm 에이전트에 필수 필드 존재", () => {
    const agents = loadAgents();
    expect(agents.pm.name).toBeTruthy();
    expect(agents.pm.systemPrompt).toBeTruthy();
    expect(agents.pm.tools.length).toBeGreaterThan(0);
  });

  test("커스텀 yml로 systemPrompt 오버라이드", () => {
    const custom: AgentsFile = {
      agents: {
        pm: { systemPrompt: "커스텀 PM 프롬프트" },
      },
    };
    const agents = loadAgents(custom);
    expect(agents.pm.systemPrompt).toBe("커스텀 PM 프롬프트");
    // 오버라이드하지 않은 필드는 기본값 유지
    expect(agents.pm.name).toBeTruthy();
  });

  test("extends로 다른 에이전트 설정 상속", () => {
    const custom: AgentsFile = {
      agents: {
        "fe-senior": {
          extends: "fe",
          name: "Senior Frontend Engineer",
          systemPrompt: "시니어 FE 프롬프트",
        },
      },
    };
    const agents = loadAgents(custom);
    expect(agents["fe-senior"]).toBeDefined();
    expect(agents["fe-senior"].name).toBe("Senior Frontend Engineer");
    // extends한 fe의 tools 상속
    expect(agents["fe-senior"].tools).toEqual(agents.fe.tools);
  });

  test("disabled: true인 에이전트 제외", () => {
    const custom: AgentsFile = {
      agents: { designer: { disabled: true } },
    };
    const agents = loadAgents(custom);
    expect(agents.designer).toBeUndefined();
  });
});

describe("워크플로 loader", () => {
  test("기본 workflow 로드 성공", () => {
    const workflow = getWorkflow();
    expect(workflow.jobs).toBeDefined();
    expect(Object.keys(workflow.jobs).length).toBeGreaterThan(0);
  });

  test("planning job이 시작점으로 감지됨 (어떤 end에도 없음)", () => {
    const workflow = getWorkflow();
    const allTargets = new Set(
      Object.values(workflow.jobs).flatMap(j => Object.keys(j.end ?? {}))
    );
    const startJobs = Object.keys(workflow.jobs).filter(id => !allTargets.has(id));
    expect(startJobs).toHaveLength(1);
    expect(startJobs[0]).toBe("planning");
  });

  test("커스텀 workflow로 job end 오버라이드", () => {
    const custom: AgentsFile = {
      agents: {},
      workflow: {
        jobs: {
          qa: {
            description: "커스텀 QA",
            end: { deploy: "테스트 통과 시", hotfix: "크리티컬 버그 발견 시" },
          },
        },
      },
    };
    const workflow = getWorkflow(custom);
    expect(workflow.jobs.qa.description).toBe("커스텀 QA");
    expect(workflow.jobs.qa.end?.hotfix).toBeDefined();
    // 다른 job은 기본값 유지
    expect(workflow.jobs.planning).toBeDefined();
  });
});
```

- [ ] **Step 4: 테스트 실행 → 실패 확인**

```bash
bun test src/agents/loader.test.ts
```

- [ ] **Step 5: `agents.default.yml` 작성**

```yaml
# agents.default.yml
# relay 기본 에이전트 페르소나 정의.
# 수정하지 말고 agents.yml에서 오버라이드하세요.

agents:
  pm:
    name: "Product Manager"
    emoji: "📋"
    description: "요구사항 분석, 태스크 분해, 이슈 생성"
    tools:
      - create_task
      - update_task
      - get_my_tasks
      - send_message
      - get_messages
    systemPrompt: |
      당신은 스타트업의 Product Manager입니다.

      ## 역할
      - 사용자의 요구사항을 분석하여 구체적인 개발 태스크로 분해합니다
      - 각 태스크를 적절한 담당자(fe, be, designer, da, qa)에게 배정합니다
      - 워크플로가 막히거나 블로커가 생기면 중재합니다

      ## 워크플로
      1. get_messages로 현재 상황 파악
      2. 요구사항을 5~10개의 구체적 태스크로 분해
      3. create_task로 각 태스크 생성 (적절한 assignee, priority 지정)
      4. 완료 후 job 설명의 지시에 따라 end 선언

      ## 규칙
      - agent_id는 항상 "pm"으로 설정
      - 태스크 description은 완료 기준이 명확하게 작성
      - 우선순위 기준: critical(서비스 불가) > high(핵심 기능) > medium(일반) > low(nice-to-have)

  designer:
    name: "UX Designer"
    emoji: "🎨"
    description: "UX 플로우 설계, 컴포넌트 스펙 작성"
    tools:
      - get_messages
      - get_my_tasks
      - update_task
      - post_artifact
      - get_artifact
      - send_message
    systemPrompt: |
      당신은 스타트업의 UX Designer입니다.

      ## 역할
      - PM의 요구사항을 바탕으로 사용자 플로우와 컴포넌트 스펙을 설계합니다
      - 텍스트 기반의 상세한 UI 스펙을 작성합니다

      ## 산출물 형식
      post_artifact 호출 시:
        name: "{feature}-design-spec"
        type: "figma_spec"
        content: JSON (화면별 컴포넌트, 상태, 인터랙션, 엣지케이스 기술)

      ## 규칙
      - agent_id는 항상 "designer"로 설정
      - 스펙 완료 후 post_artifact로 공유하고 job 설명의 지시에 따라 end 선언

  da:
    name: "Data Analyst"
    emoji: "📊"
    description: "이벤트 설계, 성과 지표 정의, 측정 계획 수립"
    tools:
      - get_messages
      - get_my_tasks
      - update_task
      - get_artifact
      - post_artifact
      - send_message
    systemPrompt: |
      당신은 스타트업의 Data Analyst입니다.

      ## 역할
      - 디자인 스펙을 바탕으로 측정이 필요한 사용자 행동 이벤트를 설계합니다
      - 성과 지표(KPI, 노스스타 메트릭)와 측정 방법을 정의합니다
      - FE/BE 개발자에게 어떤 이벤트를 어디서 발화해야 하는지 가이드합니다

      ## 산출물 형식
      post_artifact 호출 시:
        name: "{feature}-analytics-plan"
        type: "analytics_plan"
        content: JSON (이벤트명, 파라미터, 발화 시점, KPI 매핑)

      ## 규칙
      - agent_id는 항상 "da"로 설정
      - 계획 완료 후 post_artifact로 공유하고 job 설명의 지시에 따라 end 선언

  fe:
    name: "Frontend Engineer"
    emoji: "💻"
    description: "UI 구현, PR 생성, FE 코드리뷰"
    tools:
      - get_messages
      - get_my_tasks
      - update_task
      - get_artifact
      - post_artifact
      - send_message
      - request_review
      - submit_review
    systemPrompt: |
      당신은 스타트업의 Frontend Engineer입니다.

      ## 역할
      - 디자인 스펙과 분석 계획을 바탕으로 UI를 구현합니다
      - PR 아티팩트를 생성하고 다른 FE에게 코드리뷰를 요청합니다
      - 다른 FE의 리뷰 요청이 오면 꼼꼼하게 리뷰합니다

      ## 산출물 형식
      post_artifact 호출 시:
        name: "{feature}-fe-pr"
        type: "pr"
        content: 구현 내용, 변경 파일, 주요 결정사항, 테스트 방법 기술

      ## 규칙
      - agent_id는 "fe" 또는 "fe2"로 설정 (리뷰어 역할 시 "fe2")
      - 구현 완료 후 반드시 다른 FE(fe2)에게 request_review
      - 리뷰 승인 후에만 update_task로 "done" 처리

  be:
    name: "Backend Engineer"
    emoji: "⚙️"
    description: "API 설계 및 구현, PR 생성, BE 코드리뷰"
    tools:
      - get_messages
      - get_my_tasks
      - update_task
      - get_artifact
      - post_artifact
      - send_message
      - request_review
      - submit_review
    systemPrompt: |
      당신은 스타트업의 Backend Engineer입니다.

      ## 역할
      - API를 설계하고 구현합니다
      - PR 아티팩트를 생성하고 다른 BE에게 코드리뷰를 요청합니다
      - 다른 BE의 리뷰 요청이 오면 보안, 성능, 확장성 관점에서 꼼꼼하게 리뷰합니다

      ## 산출물 형식
      post_artifact 호출 시:
        name: "{feature}-be-pr"
        type: "pr"
        content: API 스펙, 구현 내용, DB 스키마 변경, 성능 고려사항 기술

      ## 규칙
      - agent_id는 "be" 또는 "be2"로 설정 (리뷰어 역할 시 "be2")
      - 구현 완료 후 반드시 다른 BE(be2)에게 request_review
      - 리뷰 승인 후에만 update_task로 "done" 처리

  qa:
    name: "QA Engineer"
    emoji: "🔍"
    description: "테스트 시나리오 작성, 버그 리포트, 최종 승인"
    tools:
      - get_messages
      - get_my_tasks
      - update_task
      - get_artifact
      - post_artifact
      - send_message
      - create_task
    systemPrompt: |
      당신은 스타트업의 QA Engineer입니다.

      ## 역할
      - 구현된 기능의 테스트 시나리오를 작성하고 검증합니다
      - 버그 발견 시 상세한 재현 절차와 함께 버그 티켓을 생성합니다
      - 모든 버그가 해결되면 최종 승인하고 배포 준비 완료를 알립니다

      ## 산출물 형식
      post_artifact 호출 시:
        name: "{feature}-qa-report"
        type: "report"
        content: 테스트 시나리오, 통과/실패 결과, 버그 목록 기술

      ## 규칙
      - agent_id는 항상 "qa"로 설정
      - 버그 티켓은 create_task로 생성 (assignee: 해당 개발자)
      - 모든 버그 티켓이 "done"이 될 때까지 반복 검증

  deployer:
    name: "Deployer"
    emoji: "🚀"
    description: "최종 배포 실행 및 결과 보고"
    tools:
      - get_messages
      - get_my_tasks
      - update_task
      - get_artifact
      - send_message
      - append_memory
    systemPrompt: |
      당신은 배포 담당자입니다.

      ## 역할
      - QA에서 all-clear 신호를 받으면 배포를 진행합니다
      - 배포 전 체크리스트를 확인합니다 (모든 태스크 done, 리뷰 승인 완료)
      - 배포 결과를 팀에게 알립니다
      - 세션 종료 전 `append_memory`로 배포 히스토리를 기록합니다

      ## 규칙
      - agent_id는 항상 "deployer"로 설정
      - 배포 완료 후 send_message(to: null)로 전체 공지하고 job 설명의 지시에 따라 end 선언

workflow:
  jobs:
    planning:
      agents: [pm]
      description: "사용자 요구사항을 분석하고 태스크를 분해한다."
      end:
        design: "모든 태스크가 생성되고 담당자에게 배정되면"

    design:
      agents: [designer, da]
      description: "Designer는 UX 스펙, DA는 분석 계획을 작성한다. 둘 다 완료되어야 한다."
      end:
        development: "두 산출물이 모두 post_artifact로 공유되면"

    development:
      agents: [fe, be]
      description: "FE는 UI를, BE는 API를 구현하고 PR 아티팩트를 작성한다."
      end:
        review: "구현이 완료되어 PR이 준비되면"

    review:
      agents: [fe2, be2]
      reviewers:
        fe: [fe2]
        be: [be2]
      description: "PR을 리뷰한다. 품질, 보안, 성능 관점에서 검토한다."
      end:
        qa: "모든 PR이 LGTM이면"
        development: "수정이 필요한 피드백이 있으면"

    qa:
      agents: [qa]
      description: "기능을 테스트하고 버그를 발견하면 티켓을 생성한다."
      end:
        deploy: "모든 테스트를 통과하고 버그 티켓이 없으면"
        development: "버그가 발견되어 수정이 필요하면"

    deploy:
      agents: [deployer]
      description: "QA를 통과한 기능을 프로덕션에 배포한다."
      end:
        _done: "배포가 완료되고 팀에 공지되면"
```

- [ ] **Step 6: `agents.yml` 예시 파일 작성 (사용자 편집용)**

```yaml
# agents.yml
# 이 파일에서 에이전트 페르소나를 자유롭게 커스터마이즈하세요.
# 명시하지 않은 필드는 agents.default.yml의 값이 사용됩니다.
#
# 사용 예시:
#
# 1. 기존 에이전트 systemPrompt 오버라이드:
#   agents:
#     fe:
#       systemPrompt: |
#         당신은 Next.js 전문 FE 엔지니어입니다...
#
# 2. 기존 에이전트 비활성화:
#   agents:
#     designer:
#       disabled: true
#
# 3. 커스텀 에이전트 추가 (extends로 기존 상속):
#   agents:
#     security-reviewer:
#       name: "Security Reviewer"
#       emoji: "🔐"
#       extends: "be"
#       systemPrompt: |
#         당신은 보안 전문가입니다. OWASP Top 10 관점에서 리뷰합니다...
#
# 4. workflow job 오버라이드 (QA 루프를 hotfix job으로 분리):
#   workflow:
#     jobs:
#       qa:
#         end:
#           deploy: "모든 테스트를 통과하면"
#           hotfix: "크리티컬 버그가 발견되면"
#       hotfix:
#         agents: [be]
#         description: "크리티컬 버그만 긴급 수정한다."
#         end:
#           qa: "수정이 완료되어 재검증이 필요하면"

agents: {}
```

- [ ] **Step 7: `loader.ts` 구현**

```typescript
// src/agents/loader.ts
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import yaml from "js-yaml";
import type { AgentPersona, AgentConfig, AgentsFile, WorkflowConfig } from "./types";

// agents.default.yml은 relay 패키지 루트에 위치 (src/agents/../../ = relay/)
// MCP 서버가 사용자 프로젝트 디렉토리에서 실행될 때도 올바른 경로를 찾기 위해
// process.cwd() 대신 import.meta.dir(현재 파일 위치) 기준으로 탐색
const RELAY_PKG_ROOT = join(import.meta.dir, "../..");

// agents.yml은 프로젝트별 커스텀 가능 → CWD(사용자 프로젝트 루트) 기준
const PROJECT_ROOT = process.cwd();

function readYml(path: string): AgentsFile | null {
  if (!existsSync(path)) return null;
  return yaml.load(readFileSync(path, "utf-8")) as AgentsFile;
}

export function loadAgents(override?: AgentsFile): Record<string, AgentPersona> {
  // 1. 기본값 로드 (relay 패키지 내장)
  const defaultFile = readYml(join(RELAY_PKG_ROOT, "agents.default.yml"));
  if (!defaultFile) throw new Error("agents.default.yml 파일을 찾을 수 없습니다");

  // 2. 사용자 커스텀 로드 (없으면 빈 객체) — 프로젝트 루트 기준
  const customFile = override ?? readYml(join(PROJECT_ROOT, "agents.yml")) ?? { agents: {} };

  // 3. 기본값 + 커스텀 merge
  const defaults = defaultFile.agents;
  const customs = customFile.agents;

  const merged: Record<string, AgentPersona> = {};

  // 기본 에이전트 처리
  for (const [id, config] of Object.entries(defaults)) {
    const custom = customs[id] ?? {};
    if (custom.disabled) continue;
    merged[id] = { id, ...config, ...custom } as AgentPersona;
  }

  // 커스텀 전용 에이전트 처리 (extends 또는 신규)
  for (const [id, config] of Object.entries(customs)) {
    if (id in merged) continue;         // 이미 처리됨
    if (config.disabled) continue;

    if (config.extends) {
      const base = merged[config.extends] ?? defaults[config.extends];
      if (!base) throw new Error(`extends 대상 "${config.extends}"을 찾을 수 없습니다`);
      merged[id] = { ...base, ...config, id, extends: undefined } as AgentPersona;
    } else {
      merged[id] = { id, ...config } as AgentPersona;
    }
  }

  return merged;
}

export function getWorkflow(override?: AgentsFile): WorkflowConfig {
  const defaultFile = readYml(join(RELAY_PKG_ROOT, "agents.default.yml"));
  if (!defaultFile) throw new Error("agents.default.yml 파일을 찾을 수 없습니다");

  const customFile = override ?? readYml(join(PROJECT_ROOT, "agents.yml")) ?? { agents: {} };

  const defaultJobs = defaultFile.workflow?.jobs ?? {};
  const customJobs = customFile.workflow?.jobs ?? {};

  // job 단위 오버라이드 (각 job의 필드 수준 merge)
  const mergedJobs = { ...defaultJobs };
  for (const [jobId, jobOverride] of Object.entries(customJobs)) {
    mergedJobs[jobId] = { ...mergedJobs[jobId], ...jobOverride };
  }

  return { jobs: mergedJobs };
}
```

- [ ] **Step 8: 테스트 통과 확인**

```bash
bun test src/agents/loader.test.ts
```
Expected: PASS (8개 테스트)

- [ ] **Step 9: mcp.ts에서 loadAgents() 활용**

```typescript
// src/mcp.ts 에 추가
import { loadAgents, getWorkflow } from "./agents/loader";

// createMcpServer() 안에서 에이전트 목록 노출용 툴 등록
const agents = loadAgents();

server.tool("list_agents", {}, async () => {
  return {
    content: [{
      type: "text",
      text: JSON.stringify(
        Object.values(agents).map(a => ({
          id: a.id, name: a.name, emoji: a.emoji,
          description: a.description, tools: a.tools,
        }))
      ),
    }],
  };
});

// 워크플로 설정 조회 (오케스트레이터가 실행 흐름 파악에 사용)
server.tool("get_workflow", {}, async () => {
  const workflow = getWorkflow();
  return {
    content: [{ type: "text", text: JSON.stringify(workflow) }],
  };
});
```

- [ ] **Step 10: Commit**

```bash
git add src/agents/ agents.default.yml agents.yml src/mcp.ts
git commit -m "feat: YAML 기반 에이전트 페르소나 + workflow 설정 시스템 구현"
```

---

## Chunk 6: 대시보드 프론트엔드 (React + Vite)

### Task 13: 프론트엔드 패키지 초기화

**Files:**
- Create: `dashboard/package.json`
- Create: `dashboard/vite.config.ts`
- Create: `dashboard/index.html`

- [ ] **Step 1: 대시보드 패키지 초기화**

```bash
mkdir -p dashboard
cd dashboard
bun create vite . --template react-ts
bun add tailwindcss @tailwindcss/vite
```

- [ ] **Step 2: vite.config.ts 설정 (프록시 포함)**

```typescript
// dashboard/vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      // relay/shared/ 를 @shared 로 참조 — 서버-대시보드 공유 타입 접근
      "@shared": resolve(__dirname, "../shared"),
    },
  },
  server: {
    proxy: {
      "/api": "http://localhost:3456",
      "/ws": { target: "ws://localhost:3456", ws: true },
    },
  },
  build: { outDir: "dist" },  // → relay/dashboard/dist (hono.ts의 DASHBOARD_DIST와 일치)
});
```

- [ ] **Step 3: `dashboard/tsconfig.json`에 `@shared` 경로 alias 추가**

`bun create vite` 생성 후, `dashboard/tsconfig.json` (또는 `tsconfig.app.json`)에 paths 추가:
```json
{
  "compilerOptions": {
    "paths": {
      "@shared/*": ["../shared/*"]
    }
  }
}
```
TypeScript 타입 체킹이 `@shared/types` 임포트를 올바르게 해석할 수 있도록 한다.

- [ ] **Step 4: Commit**

```bash
git add dashboard/
git commit -m "chore: 대시보드 프론트엔드 초기화 (React + Vite + Tailwind)"
```

---

### Task 14: WebSocket 훅 + 타입

**Files:**
- Create: `dashboard/src/types.ts`
- Create: `dashboard/src/hooks/useRelaySocket.ts`

- [ ] **Step 1: 공유 타입 연결**

```typescript
// dashboard/src/types.ts
// shared/types.ts에서 re-export — 타입 정의는 한 곳에만
export type { AgentId, RelayEvent } from "@shared/types";
```

- [ ] **Step 2: useRelaySocket 훅 구현**

```typescript
// dashboard/src/hooks/useRelaySocket.ts
import { useEffect, useRef, useState } from "react";
import type { RelayEvent } from "../types";

export function useRelaySocket(url: string) {
  const [events, setEvents] = useState<RelayEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const ws = useRef<WebSocket | null>(null);

  useEffect(() => {
    ws.current = new WebSocket(url);

    ws.current.onopen = () => setConnected(true);
    ws.current.onclose = () => setConnected(false);
    ws.current.onmessage = (e) => {
      try {
        const event: RelayEvent = JSON.parse(e.data);
        setEvents(prev => [...prev, event]);
      } catch (err) {
        console.warn("[relay] WebSocket 메시지 파싱 실패:", err);
      }
    };

    return () => ws.current?.close();
  }, [url]);

  return { events, connected };
}
```

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/types.ts dashboard/src/hooks/
git commit -m "feat: WebSocket 훅 구현"
```

---

### Task 15: 3패널 레이아웃 + 컴포넌트

**Files:**
- Create: `dashboard/src/App.tsx`
- Create: `dashboard/src/components/AgentStatusBar.tsx`
- Create: `dashboard/src/components/TaskBoard.tsx`
- Create: `dashboard/src/components/MessageFeed.tsx`
- Create: `dashboard/src/components/AgentThoughts.tsx`

- [ ] **Step 1: AgentStatusBar 구현 (동적 에이전트 목록)**

`/api/agents`에서 에이전트 목록을 가져와 표시한다. agents.yml에서 커스텀 에이전트를 추가해도 자동 반영된다.

```tsx
// dashboard/src/components/AgentStatusBar.tsx
import { useEffect, useState } from "react";
import type { AgentId } from "../types";

interface AgentMeta { id: AgentId; name: string; emoji: string }

interface Props {
  statuses: Partial<Record<AgentId, "idle" | "working" | "waiting">>;
  selected: AgentId | null;
  onSelect: (id: AgentId) => void;
}

export function AgentStatusBar({ statuses, selected, onSelect }: Props) {
  const [agents, setAgents] = useState<AgentMeta[]>([]);

  useEffect(() => {
    fetch("/api/agents").then(r => r.json()).then(setAgents);
  }, []);

  return (
    <div className="flex gap-3 p-3 bg-gray-900 border-b border-gray-700">
      {agents.map(({ id, name, emoji }) => {
        const status = statuses[id] ?? "idle";
        const isWorking = status === "working";
        const isSelected = selected === id;
        return (
          <button
            key={id}
            onClick={() => onSelect(id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all
              ${isSelected ? "ring-2 ring-blue-400" : ""}
              ${isWorking ? "bg-green-900 text-green-300" : "bg-gray-800 text-gray-400"}`}
          >
            <span>{emoji}</span>
            <span>{name}</span>
            <span className={`w-2 h-2 rounded-full ${isWorking ? "bg-green-400 animate-pulse" : "bg-gray-600"}`} />
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: TaskBoard (Kanban) 구현**

```tsx
// dashboard/src/components/TaskBoard.tsx
interface Task {
  id: string; title: string; assignee: string | null;
  status: string; priority: string;
}

const COLUMNS = ["todo", "in_progress", "in_review", "done"] as const;
const COLUMN_LABELS = { todo: "Todo", in_progress: "In Progress", in_review: "In Review", done: "Done" };
const PRIORITY_COLOR = { critical: "bg-red-500", high: "bg-orange-400", medium: "bg-yellow-400", low: "bg-gray-400" };

export function TaskBoard({ tasks }: { tasks: Task[] }) {
  return (
    <div className="flex gap-3 p-3 h-full overflow-x-auto">
      {COLUMNS.map(col => (
        <div key={col} className="flex-1 min-w-40">
          <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">
            {COLUMN_LABELS[col]} ({tasks.filter(t => t.status === col).length})
          </h3>
          <div className="flex flex-col gap-2">
            {tasks.filter(t => t.status === col).map(task => (
              <div key={task.id} className="bg-gray-800 rounded-lg p-2.5 text-sm">
                <div className="flex items-start gap-2">
                  <span className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${PRIORITY_COLOR[task.priority as keyof typeof PRIORITY_COLOR] ?? "bg-gray-400"}`} />
                  <span className="text-gray-200 leading-snug">{task.title}</span>
                </div>
                {task.assignee && (
                  <div className="mt-1.5 text-xs text-gray-500">→ {task.assignee}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: MessageFeed 구현**

```tsx
// dashboard/src/components/MessageFeed.tsx
interface Message {
  id: string; from_agent: string; to_agent: string | null;
  content: string; created_at: number;
}

const AGENT_COLORS: Record<string, string> = {
  pm: "text-purple-400", designer: "text-pink-400", da: "text-yellow-400",
  fe: "text-blue-400", be: "text-green-400", qa: "text-orange-400",
};

export function MessageFeed({ messages }: { messages: Message[] }) {
  return (
    <div className="flex flex-col gap-3 p-3 overflow-y-auto h-full">
      {messages.map(msg => (
        <div key={msg.id} className="bg-gray-800 rounded-lg p-3 text-sm">
          <div className="flex items-center gap-2 mb-1">
            <span className={`font-semibold ${AGENT_COLORS[msg.from_agent] ?? "text-gray-300"}`}>
              {msg.from_agent}
            </span>
            {msg.to_agent && (
              <>
                <span className="text-gray-600">→</span>
                <span className={`font-semibold ${AGENT_COLORS[msg.to_agent] ?? "text-gray-300"}`}>
                  {msg.to_agent}
                </span>
              </>
            )}
            {!msg.to_agent && <span className="text-xs text-gray-600">(전체)</span>}
          </div>
          <p className="text-gray-300 leading-relaxed">{msg.content}</p>
        </div>
      ))}
      {messages.length === 0 && (
        <p className="text-gray-600 text-sm text-center mt-8">아직 메시지가 없습니다</p>
      )}
    </div>
  );
}
```

- [ ] **Step 4: AgentThoughts (실시간 스트림) 구현**

```tsx
// dashboard/src/components/AgentThoughts.tsx
import type { AgentId } from "../types";

interface Props {
  agentId: AgentId | null;
  chunks: string[];  // 선택된 에이전트의 thinking 청크 누적
}

export function AgentThoughts({ agentId, chunks }: Props) {
  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-gray-700">
        <span className="text-xs font-semibold text-gray-400 uppercase">
          {agentId ? `${agentId} 생각 중...` : "에이전트를 선택하세요"}
        </span>
      </div>
      <div className="flex-1 p-3 overflow-y-auto font-mono text-sm text-green-300 leading-relaxed">
        {chunks.join("")}
        {chunks.length > 0 && (
          <span className="inline-block w-2 h-4 bg-green-400 animate-pulse ml-0.5" />
        )}
        {chunks.length === 0 && agentId && (
          <span className="text-gray-600">대기 중...</span>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: App.tsx 조립**

```tsx
// dashboard/src/App.tsx
import { useState, useMemo, useEffect } from "react";
import { useRelaySocket } from "./hooks/useRelaySocket";
import { AgentStatusBar } from "./components/AgentStatusBar";
import { TaskBoard } from "./components/TaskBoard";
import { MessageFeed } from "./components/MessageFeed";
import { AgentThoughts } from "./components/AgentThoughts";
import type { AgentId, RelayEvent } from "./types";

const WS_URL = `ws://${window.location.host}/ws`;

export default function App() {
  const { events, connected } = useRelaySocket(WS_URL);
  const [selectedAgent, setSelectedAgent] = useState<AgentId | null>(null);
  const [snapshot, setSnapshot] = useState({ tasks: [], messages: [], artifacts: [] });

  // 초기 스냅샷 로드
  useEffect(() => {
    fetch("/api/session").then(r => r.json()).then(setSnapshot);
  }, []);

  // 이벤트 누적으로 상태 파생
  const { tasks, messages, agentStatuses, thinkingChunks } = useMemo(() => {
    let tasks = [...snapshot.tasks] as any[];
    let messages = [...snapshot.messages] as any[];
    const agentStatuses: Partial<Record<AgentId, "idle" | "working" | "waiting">> = {};
    const thinkingChunks: Partial<Record<AgentId, string[]>> = {};

    for (const event of events) {
      if (event.type === "task:updated") {
        const idx = tasks.findIndex(t => t.id === event.task.id);
        if (idx >= 0) tasks[idx] = { ...tasks[idx], ...event.task };
        else tasks.push(event.task);
      } else if (event.type === "message:new") {
        messages.push(event.message);
      } else if (event.type === "agent:status") {
        agentStatuses[event.agentId] = event.status;
      } else if (event.type === "agent:thinking") {
        if (!thinkingChunks[event.agentId]) thinkingChunks[event.agentId] = [];
        thinkingChunks[event.agentId]!.push(event.chunk);
      } else if (event.type === "session:snapshot") {
        // 전체 상태를 서버 스냅샷으로 교체 (재연결 시 동기화)
        tasks = [...(event.tasks as any[])];
        messages = [...(event.messages as any[])];
      }
    }

    return { tasks, messages, agentStatuses, thinkingChunks };
  }, [events, snapshot]);

  return (
    <div className="h-screen flex flex-col bg-gray-950 text-white">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800">
        <span className="font-bold text-lg">relay</span>
        <span className={`text-xs px-2 py-1 rounded-full ${connected ? "bg-green-900 text-green-300" : "bg-red-900 text-red-300"}`}>
          {connected ? "연결됨" : "연결 끊김"}
        </span>
      </div>

      {/* 에이전트 상태바 */}
      <AgentStatusBar
        statuses={agentStatuses}
        selected={selectedAgent}
        onSelect={setSelectedAgent}
      />

      {/* 3패널 */}
      <div className="flex flex-1 overflow-hidden divide-x divide-gray-800">
        <div className="w-1/3 overflow-hidden">
          <div className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase border-b border-gray-800">
            Task Board
          </div>
          <div className="h-[calc(100%-33px)] overflow-y-auto">
            <TaskBoard tasks={tasks} />
          </div>
        </div>
        <div className="w-1/3 overflow-hidden">
          <div className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase border-b border-gray-800">
            Message Feed
          </div>
          <div className="h-[calc(100%-33px)] overflow-y-auto">
            <MessageFeed messages={messages} />
          </div>
        </div>
        <div className="w-1/3 overflow-hidden">
          <AgentThoughts
            agentId={selectedAgent}
            chunks={selectedAgent ? (thinkingChunks[selectedAgent] ?? []) : []}
          />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: 프론트엔드 개발 서버 기동 확인**

```bash
# 터미널 1: 백엔드
RELAY_SESSION_ID=test bun run src/index.ts

# 터미널 2: 프론트엔드
cd dashboard && bun run dev
```

브라우저에서 `http://localhost:5173` 접속, 3패널 레이아웃 확인

- [ ] **Step 7: 프로덕션 빌드 + 통합 확인**

```bash
cd dashboard && bun run build
# 백엔드가 dist 파일 서빙 확인
curl http://localhost:3456/
```

- [ ] **Step 8: package.json scripts 업데이트**

```json
{
  "scripts": {
    "dev": "bun run --watch src/index.ts",
    "start": "bun run src/index.ts",
    "test": "bun test",
    "dashboard:dev": "cd dashboard && bun run dev",
    "dashboard:build": "cd dashboard && bun run build",
    "docs:dev": "cd docs-site && bun run dev",
    "docs:build": "cd docs-site && bun run build"
  }
}
```

> `check`, `lint`, `format` 스크립트는 Task 22 (Biome 설치) 완료 후 추가.
> Task 15 시점에는 Biome가 설치되지 않으므로 미리 추가하지 않는다.

- [ ] **Step 9: Commit**

```bash
git add dashboard/src/ package.json
git commit -m "feat: 대시보드 프론트엔드 3패널 UI 구현"
```

---

## Chunk 7: 메모리 시스템

### Task 16: 메모리 MCP 툴

**Files:**
- Create: `src/tools/memory.ts`
- Test: `src/tools/memory.test.ts`
- Modify: `src/mcp.ts`

- [ ] **Step 1: 테스트 작성**

```typescript
// src/tools/memory.test.ts
import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdirSync, rmSync, existsSync } from "fs";
import { join } from "path";
import {
  handleReadMemory,
  handleWriteMemory,
  handleAppendMemory,
} from "./memory";

const TEST_DIR = join(import.meta.dir, "../../.relay-test");

describe("메모리 툴", () => {
  beforeEach(() => mkdirSync(join(TEST_DIR, "memory/agents"), { recursive: true }));
  afterEach(() => rmSync(TEST_DIR, { recursive: true, force: true }));

  test("write_memory: 에이전트 기억 저장", async () => {
    const result = await handleWriteMemory(TEST_DIR, {
      agent_id: "fe",
      key: "conventions",
      content: "항상 서버/클라이언트 컴포넌트를 분리한다",
    });
    expect(result.success).toBe(true);
    expect(existsSync(join(TEST_DIR, "memory/agents/fe.md"))).toBe(true);
  });

  test("read_memory: 저장된 기억 조회", async () => {
    await handleWriteMemory(TEST_DIR, {
      agent_id: "be",
      key: "api-pattern",
      content: "모든 응답은 { data, error } 구조",
    });
    const result = await handleReadMemory(TEST_DIR, { agent_id: "be" });
    expect(result.success).toBe(true);
    expect(result.content).toContain("모든 응답은 { data, error } 구조");
  });

  test("read_memory: 존재하지 않으면 null 반환", async () => {
    const result = await handleReadMemory(TEST_DIR, { agent_id: "da" });
    expect(result.success).toBe(true);
    expect(result.content).toBeNull();
  });

  test("append_memory: 기억 누적 추가", async () => {
    await handleWriteMemory(TEST_DIR, { agent_id: "qa", key: "init", content: "첫 번째 기억" });
    await handleAppendMemory(TEST_DIR, { agent_id: "qa", content: "두 번째 기억" });
    const result = await handleReadMemory(TEST_DIR, { agent_id: "qa" });
    expect(result.content).toContain("첫 번째 기억");
    expect(result.content).toContain("두 번째 기억");
  });

  test("append_memory: agent_id 없으면 lessons.md에 저장", async () => {
    await handleAppendMemory(TEST_DIR, { content: "팀 회고: auth 헤더 주의" });
    expect(existsSync(join(TEST_DIR, "memory/lessons.md"))).toBe(true);
    // project.md에는 쓰이지 않아야 함
    expect(existsSync(join(TEST_DIR, "memory/project.md"))).toBe(false);
  });

  test("read_memory: agent_id 없으면 project + lessons 합쳐서 반환", async () => {
    await handleWriteMemory(TEST_DIR, { key: "summary", content: "프로젝트 요약" });
    await handleAppendMemory(TEST_DIR, { content: "lessons 내용" });
    const result = await handleReadMemory(TEST_DIR, {});
    expect(result.content).toContain("프로젝트 요약");
    expect(result.content).toContain("lessons 내용");
  });
});
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

```bash
bun test src/tools/memory.test.ts
```

- [ ] **Step 3: 구현**

```typescript
// src/tools/memory.ts
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

// 에이전트별 메모리 파일 경로
function agentMemoryPath(relayDir: string, agentId: string): string {
  return join(relayDir, "memory", "agents", `${agentId}.md`);
}

function projectMemoryPath(relayDir: string): string {
  return join(relayDir, "memory", "project.md");
}

function lessonsMemoryPath(relayDir: string): string {
  return join(relayDir, "memory", "lessons.md");
}

function ensureDir(path: string): void {
  mkdirSync(join(path, "memory", "agents"), { recursive: true });
}

export async function handleReadMemory(
  relayDir: string,
  input: { agent_id?: string }
) {
  // agent_id 없으면 project.md + lessons.md 합쳐서 반환
  if (!input.agent_id) {
    const project = existsSync(projectMemoryPath(relayDir))
      ? readFileSync(projectMemoryPath(relayDir), "utf-8")
      : null;
    const lessons = existsSync(lessonsMemoryPath(relayDir))
      ? readFileSync(lessonsMemoryPath(relayDir), "utf-8")
      : null;
    const content = [project, lessons].filter((s): s is string => s !== null).join("\n\n---\n\n") || null;
    return { success: true, content };
  }
  const path = agentMemoryPath(relayDir, input.agent_id);
  if (!existsSync(path)) return { success: true, content: null };
  return { success: true, content: readFileSync(path, "utf-8") };
}

export async function handleWriteMemory(
  relayDir: string,
  input: { agent_id?: string; key: string; content: string }
) {
  ensureDir(relayDir);
  const path = input.agent_id
    ? agentMemoryPath(relayDir, input.agent_id)
    : projectMemoryPath(relayDir);

  const existing = existsSync(path) ? readFileSync(path, "utf-8") : "";

  // key 섹션이 있으면 교체, 없으면 추가
  // 주의: g flag + test()는 lastIndex를 이동시키므로 존재 확인엔 별도 regex 사용
  const section = `\n## ${input.key}\n\n${input.content}\n`;
  const checkPattern = new RegExp(`\n## ${input.key}\n`);
  const replacePattern = new RegExp(`\n## ${input.key}\n[\\s\\S]*?(?=\n## |$)`, "g");
  const updated = checkPattern.test(existing)
    ? existing.replace(replacePattern, section)
    : existing + section;

  writeFileSync(path, updated.trim() + "\n");
  return { success: true };
}

export async function handleAppendMemory(
  relayDir: string,
  input: { agent_id?: string; content: string }
) {
  ensureDir(relayDir);
  // agent_id 없으면 팀 공유 lessons.md에 누적 (project.md는 write_memory로만 갱신)
  const path = input.agent_id
    ? agentMemoryPath(relayDir, input.agent_id)
    : lessonsMemoryPath(relayDir);

  const timestamp = new Date().toISOString().split("T")[0];
  const entry = `\n---\n_${timestamp}_\n\n${input.content}\n`;

  const existing = existsSync(path) ? readFileSync(path, "utf-8") : "";
  writeFileSync(path, existing + entry);
  return { success: true };
}
```

- [ ] **Step 4: 에이전트 loader에서 메모리 주입**

```typescript
// src/agents/loader.ts 에 추가
export function buildSystemPromptWithMemory(
  persona: AgentPersona,
  relayDir: string
): string {
  const memoryPath = join(relayDir, "memory", "agents", `${persona.id}.md`);
  const projectPath = join(relayDir, "memory", "project.md");
  const lessonsPath = join(relayDir, "memory", "lessons.md");

  const agentMemory = existsSync(memoryPath) ? readFileSync(memoryPath, "utf-8") : null;
  const projectMemory = existsSync(projectPath) ? readFileSync(projectPath, "utf-8") : null;
  const lessonsMemory = existsSync(lessonsPath) ? readFileSync(lessonsPath, "utf-8") : null;

  const parts: string[] = [
    projectMemory ? `## 프로젝트 기억\n\n${projectMemory}` : null,
    lessonsMemory ? `## 팀 회고 및 의사결정 히스토리\n\n${lessonsMemory}` : null,
    agentMemory ? `## 내 기억 (이전 세션에서 학습)\n\n${agentMemory}` : null,
  ].filter((s): s is string => s !== null);

  if (parts.length === 0) return persona.systemPrompt;

  return `${parts.join("\n\n---\n\n")}\n\n---\n\n${persona.systemPrompt}`;
}
```

- [ ] **Step 5: mcp.ts에 메모리 툴 등록**

```typescript
// src/mcp.ts 에 추가
import { join } from "path";
import { handleReadMemory, handleWriteMemory, handleAppendMemory } from "./tools/memory";

const RELAY_DIR = process.env.RELAY_DIR ?? join(process.cwd(), ".relay");

server.tool("read_memory", {
  agent_id: z.string().optional().describe("에이전트 ID (없으면 project.md + lessons.md 반환)"),
}, async (input) => {
  const result = await handleReadMemory(RELAY_DIR, input);
  return { content: [{ type: "text", text: JSON.stringify(result) }] };
});

server.tool("write_memory", {
  agent_id: z.string().optional().describe("에이전트 ID (없으면 project.md에 저장)"),
  key: z.string().describe("기억 섹션 키 (예: conventions, api-patterns)"),
  content: z.string().describe("저장할 내용"),
}, async (input) => {
  const result = await handleWriteMemory(RELAY_DIR, input);
  return { content: [{ type: "text", text: JSON.stringify(result) }] };
});

server.tool("append_memory", {
  agent_id: z.string().optional().describe("에이전트 ID (없으면 lessons.md에 누적)"),
  content: z.string().describe("추가할 내용"),
}, async (input) => {
  const result = await handleAppendMemory(RELAY_DIR, input);
  return { content: [{ type: "text", text: JSON.stringify(result) }] };
});
```

- [ ] **Step 6: 테스트 통과 확인**

```bash
bun test src/tools/memory.test.ts
```

- [ ] **Step 7: Commit**

```bash
git add src/tools/memory.ts src/tools/memory.test.ts src/agents/loader.ts src/mcp.ts
git commit -m "feat: 메모리 툴 구현 및 system prompt 자동 주입"
```

---

### Task 17: 세션 종료 시 메모리 업데이트 + 요약 저장

**Files:**
- Create: `src/tools/sessions.ts`
- Test: `src/tools/sessions.test.ts`
- Modify: `src/mcp.ts`

- [ ] **Step 1: 테스트 작성**

```typescript
// src/tools/sessions.test.ts
import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdirSync, rmSync, existsSync } from "fs";
import { join } from "path";
import { handleSaveSessionSummary, handleListSessions, handleGetSessionSummary } from "./sessions";

const TEST_DIR = join(import.meta.dir, "../../.relay-test");

describe("세션 툴", () => {
  beforeEach(() => mkdirSync(join(TEST_DIR, "sessions"), { recursive: true }));
  afterEach(() => rmSync(TEST_DIR, { recursive: true, force: true }));

  test("세션 요약 저장", async () => {
    const result = await handleSaveSessionSummary(TEST_DIR, {
      session_id: "2026-03-13-001",
      summary: "쇼핑카트 기능 구현 완료. auth 헤더 이슈 주의.",
      tasks: [{ id: "t1", title: "장바구니 UI", status: "done" }],
      messages: [{ id: "m1", from_agent: "pm", content: "작업 시작" }],
    });
    expect(result.success).toBe(true);
    // messages.json도 저장됐는지 확인
    expect(existsSync(join(TEST_DIR, "sessions/2026-03-13-001/messages.json"))).toBe(true);
  });

  test("세션 요약 조회", async () => {
    await handleSaveSessionSummary(TEST_DIR, {
      session_id: "2026-03-13-001",
      summary: "테스트 요약",
      tasks: [],
      messages: [],
    });
    const result = await handleGetSessionSummary(TEST_DIR, { session_id: "2026-03-13-001" });
    expect(result.success).toBe(true);
    expect(result.summary).toContain("테스트 요약");
  });

  test("세션 목록 조회", async () => {
    await handleSaveSessionSummary(TEST_DIR, {
      session_id: "2026-03-13-001",
      summary: "첫 번째 세션",
      tasks: [],
      messages: [],
    });
    const result = await handleListSessions(TEST_DIR);
    expect(result.sessions).toHaveLength(1);
    expect(result.sessions[0]).toBe("2026-03-13-001");
  });
});
```

- [ ] **Step 2: 구현**

```typescript
// src/tools/sessions.ts
import { writeFileSync, readFileSync, mkdirSync, readdirSync, existsSync } from "fs";
import { join } from "path";

export async function handleSaveSessionSummary(
  relayDir: string,
  input: { session_id: string; summary: string; tasks: unknown[]; messages: unknown[] }
) {
  const dir = join(relayDir, "sessions", input.session_id);
  mkdirSync(dir, { recursive: true });

  writeFileSync(join(dir, "summary.md"), `# 세션 요약: ${input.session_id}\n\n${input.summary}\n`);
  writeFileSync(join(dir, "tasks.json"), JSON.stringify(input.tasks, null, 2));
  writeFileSync(join(dir, "messages.json"), JSON.stringify(input.messages, null, 2));

  return { success: true };
}

export async function handleListSessions(relayDir: string) {
  const sessionsDir = join(relayDir, "sessions");
  if (!existsSync(sessionsDir)) return { sessions: [] };
  // withFileTypes로 파일과 디렉토리를 구분 — 디렉토리만 세션으로 인식
  const sessions = readdirSync(sessionsDir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name)
    .sort()
    .reverse(); // 최신순
  return { sessions };
}

export async function handleGetSessionSummary(relayDir: string, input: { session_id: string }) {
  const summaryPath = join(relayDir, "sessions", input.session_id, "summary.md");
  if (!existsSync(summaryPath)) return { success: false, error: "세션을 찾을 수 없습니다" };
  return { success: true, summary: readFileSync(summaryPath, "utf-8") };
}
```

- [ ] **Step 3: mcp.ts에 `list_sessions`, `save_session_summary`, `get_session_summary` 툴 등록**

```typescript
// src/mcp.ts 에 추가
import { handleSaveSessionSummary, handleListSessions, handleGetSessionSummary } from "./tools/sessions";
// RELAY_DIR는 Task 16(메모리 툴 등록)에서 이미 선언됨

server.tool("save_session_summary", {
  agent_id: z.string().describe("호출하는 에이전트 ID (보통 오케스트레이터)"),
  session_id: z.string().describe("세션 ID (YYYY-MM-DD-NNN 형식)"),
  summary: z.string().describe("세션 요약 텍스트"),
  tasks: z.array(z.record(z.unknown())).describe("세션 내 모든 태스크"),
  messages: z.array(z.record(z.unknown())).describe("세션 내 모든 메시지"),
}, async (input) => {
  const result = await handleSaveSessionSummary(RELAY_DIR, input);
  return { content: [{ type: "text", text: JSON.stringify(result) }] };
});

server.tool("list_sessions", {
  agent_id: z.string().describe("호출하는 에이전트 ID"),
}, async (_input) => {
  const result = await handleListSessions(RELAY_DIR);
  return { content: [{ type: "text", text: JSON.stringify(result) }] };
});

server.tool("get_session_summary", {
  agent_id: z.string().describe("호출하는 에이전트 ID"),
  session_id: z.string().describe("조회할 세션 ID"),
}, async (input) => {
  const result = await handleGetSessionSummary(RELAY_DIR, { session_id: input.session_id });
  return { content: [{ type: "text", text: JSON.stringify(result) }] };
});
```

- [ ] **Step 4: `hono.ts`에 `/api/sessions/:id` 엔드포인트 추가**

`sessions.ts`가 이제 존재하므로 Task 11에서 미뤄둔 엔드포인트를 추가한다:

```typescript
// src/dashboard/hono.ts 상단 import에 추가
import { handleGetSessionSummary } from "../tools/sessions";

// 기존 라우트들 뒤에 추가
app.get("/api/sessions/:id", async (c) => {
  const relayDir = process.env.RELAY_DIR ?? join(process.cwd(), ".relay");
  const result = await handleGetSessionSummary(relayDir, { session_id: c.req.param("id") });
  if (!result.success) return c.json({ error: result.error }, 404);
  return c.json(result);
});
```

- [ ] **Step 5: 테스트 통과 확인**

```bash
bun test src/tools/sessions.test.ts
```
Expected: PASS (3개 테스트)

- [ ] **Step 6: Commit**

```bash
git add src/tools/sessions.ts src/tools/sessions.test.ts src/mcp.ts src/dashboard/hono.ts
git commit -m "feat: 세션 요약 저장 및 히스토리 조회 툴 + Hono 엔드포인트 구현"
```

---

## Chunk 8: Skills + Init Mode

### Task 18: `/relay-init` 스킬 작성

**Files:**
- Create: `skills/relay-init.md`

- [ ] **Step 1: relay-init 스킬 작성**

```markdown
<!-- skills/relay-init.md -->
# relay-init

프로젝트에 처음 relay를 사용하거나 팀이 프로젝트 컨텍스트를 새로 파악해야 할 때 실행한다.
`.relay/memory/`가 없으면 `/relay` 실행 시 자동으로 이 스킬 실행을 제안한다.

## 실행 전 확인

1. relay MCP 서버가 연결되어 있는지 확인 (`list_agents` 툴 호출)
2. `.relay/memory/` 디렉토리가 존재하는지 확인

## Phase 1: 병렬 프로젝트 스캔

아래 에이전트들을 **동시에** spawn한다 (dispatching-parallel-agents 패턴).
각 에이전트의 system prompt는 `list_agents` 툴로 로드한다.

각 에이전트에게 전달할 공통 지시:
> "프로젝트를 처음 파악하는 init 모드입니다.
>  코드베이스를 탐색하고 당신의 역할 관점에서 중요한 정보를 `write_memory` 툴로 저장하세요.
>  탐색 완료 후 `send_message(to: null, content: 'init-done')`을 보내세요."
>  (to: null은 브로드캐스트 — 모든 에이전트에게 전달됨)

**PM** — 탐색 대상:
- README.md, CLAUDE.md, package.json
- 전체 디렉토리 구조
- 기존 이슈/PR 컨텍스트 (있다면)
- 저장 키: `domain`, `architecture`, `team-conventions`

**FE** — 탐색 대상:
- 프론트엔드 코드 구조 (`src/`, `app/`, `components/` 등)
- 사용 중인 프레임워크, 상태관리, 스타일링 방식
- 저장 키: `tech-stack`, `component-patterns`, `conventions`

**BE** — 탐색 대상:
- 백엔드 코드 구조
- API 라우트, DB 스키마, 외부 서비스 의존성
- 저장 키: `api-structure`, `db-schema`, `external-deps`

**DA** — 탐색 대상:
- 기존 분석/메트릭 코드, 로깅 설정
- 저장 키: `existing-events`, `metrics-setup`

**Designer** — 탐색 대상:
- UI 컴포넌트 라이브러리 여부, 디자인 토큰
- 저장 키: `design-system`, `ui-patterns`

**QA** — 탐색 대상:
- 테스트 파일 현황, CI/CD 설정, 커버리지
- 저장 키: `test-setup`, `ci-config`, `coverage`

## Phase 2: 교차 검증

모든 에이전트의 init-done 메시지 수신 후:
- PM이 각 에이전트 기억을 읽고 `project.md` 통합 요약 작성
- `write_memory(key: 'summary', content: ...)` 로 프로젝트 전체 요약 저장

## Phase 3: 완료 보고

사용자에게 init 결과 요약:
- 파악된 기술 스택
- 주목할 만한 발견사항
- 이제 `/relay "태스크 설명"` 으로 바로 시작 가능
```

- [ ] **Step 2: Commit**

```bash
git add skills/relay-init.md
git commit -m "feat: /relay-init 스킬 작성"
```

---

### Task 19: `/relay` 메인 스킬 작성

**Files:**
- Create: `skills/relay.md`

- [ ] **Step 1: relay 스킬 작성**

```markdown
<!-- skills/relay.md -->
# relay

스타트업 팀이 태스크를 처음부터 끝까지 처리한다.
워크플로는 `agents.yml`의 `workflow` 섹션에 정의된 대로 동적으로 실행된다.

## 실행 전 확인

1. relay MCP 서버 연결 확인 (`list_agents` 호출)
2. `.relay/memory/project.md` 존재 확인
   - 없으면: "init이 필요합니다. `/relay-init`을 먼저 실행하시겠어요?" 제안
3. 새 세션 ID 생성: `YYYY-MM-DD-NNN` 형식

## 워크플로 실행

### Step 1: 워크플로 로드
`get_workflow`를 호출하여 전체 job 구성을 가져온다.

시작 job 감지: 어떤 job의 `end`에도 목적지로 지정되지 않은 job이 시작점.
```
const allTargets = new Set(jobs의 모든 end 값들의 key 목록)
const startJob = jobs 중 allTargets에 없는 job
```

### Step 2: Job 실행 루프

현재 job부터 `_done`에 도달할 때까지 반복:

```
currentJob = startJob

while (currentJob !== "_done"):
  job = workflow.jobs[currentJob]

  # job의 에이전트들을 병렬 spawn
  for each agentId in job.agents:
    spawn agent with:
      - 페르소나: list_agents로 로드
      - 기억: read_memory(agent_id) + read_memory() 합성
      - 추가 system prompt 주입:
          ## 현재 Job: {currentJob}
          {job.description}

          ## 완료 조건 및 다음 단계
          작업이 완료되면 아래 조건을 판단하여 선언하세요:
          send_message(to: null, content: "end:{nextJobId} | {이유}")
          {job.end 조건 목록}

  # 모든 에이전트의 end 선언 수집 대기
  # get_messages를 주기적으로 호출하여 content가 "end:"로 시작하는 메시지 탐지
  # job.agents 수만큼 end 선언이 모이면 다음 단계 진행
  declarations = get_messages() 결과에서 content.startsWith("end:") 필터링
                 (형식: "end:{nextJobId} | {이유}")

  # 다음 job 결정
  if all declarations point to same nextJob:
    currentJob = nextJob
  else:
    # 의견 갈림 → Claude가 job.end 조건 설명을 읽고 판단
    currentJob = decide based on job.end conditions and collected reasons
```

### Step 3: 세션 종료 (`_done` 도달 시)
1. 각 에이전트에게 `append_memory`로 이번 세션 학습 내용 저장 요청
2. `append_memory(agent_id: undefined, content: "팀 회고...")`로 `lessons.md` 업데이트
   - `agent_id`를 명시하지 않으면 프로젝트 공유 기억인 `lessons.md`에 추가됨
3. `save_session_summary`로 세션 아카이브 (tasks + messages 포함)
4. 사용자에게 결과 요약 보고

## 에이전트 spawn 패턴

각 에이전트 spawn 시 항상:
1. `list_agents`로 해당 에이전트 페르소나 로드
   - agentId가 list_agents에 없으면 reviewers 맵에서 역방향 탐색:
     `reviewers` 값 목록에서 agentId를 찾아 → key 에이전트의 페르소나 사용
     (예: fe2 → reviewers.fe = [fe2] → fe 페르소나 로드, agent_id는 fe2로 설정)
2. `read_memory(agent_id)`로 개인 기억 로드
3. `read_memory()` (agent_id 없음)로 프로젝트 기억 로드
4. system prompt = 페르소나 + 기억 + 현재 job 정보 합성
5. MCP 툴 목록 = 해당 에이전트의 `tools` 배열

## reviewers 처리

job에 `reviewers` 필드가 있으면, 리뷰어 에이전트 spawn 시 추가 컨텍스트 주입:
- `reviewers.fe: [fe2]` → fe2 spawn 시: "fe가 작성한 아티팩트를 리뷰하세요 (`get_artifact`로 fe-pr 조회)"
- 리뷰어도 동일하게 `end:{nextJobId} | {이유}` 선언으로 완료 처리
- 모든 에이전트(작업자 + 리뷰어)의 end 선언 수집 후 다음 job 결정
```

- [ ] **Step 2: Commit**

```bash
git add skills/relay.md
git commit -m "feat: /relay 메인 오케스트레이션 스킬 작성"
```

---

### Task 20: `/relay-agent` 스킬 + 설치 스크립트

**Files:**
- Create: `skills/relay-agent.md`
- Create: `scripts/install.ts`

- [ ] **Step 1: relay-agent 스킬 작성**

```markdown
<!-- skills/relay-agent.md -->
# relay-agent

특정 에이전트 한 명만 단독으로 호출한다.
예: `/relay-agent fe "CartItem 컴포넌트 리팩토링해줘"`

## 실행

1. `list_agents`로 사용 가능한 에이전트 목록 확인
2. 지정한 에이전트의 페르소나 + 메모리 로드
3. 해당 에이전트 단독 spawn
4. 완료 후 `append_memory`로 학습 내용 저장
```

- [ ] **Step 2: 설치 스크립트 작성**

```typescript
// scripts/install.ts
import { cpSync, mkdirSync } from "fs";
import { join, resolve } from "path";

const isGlobal = process.argv.includes("--global");
const relayRoot = resolve(import.meta.dir, "..");
const skillsSrc = join(relayRoot, "skills");

// 설치 대상 디렉토리
const targetDir = isGlobal
  ? join(process.env.HOME!, ".claude", "skills")
  : join(process.cwd(), ".claude", "skills");

console.log(`[relay] ${isGlobal ? "글로벌" : "로컬"} 설치 시작...`);

// 1. 스킬 파일 복사
mkdirSync(targetDir, { recursive: true });
cpSync(skillsSrc, targetDir, { recursive: true });
console.log(`[relay] 스킬 설치 완료: ${targetDir}`);

// 2. MCP 서버 등록 (Bun 내장 API 사용)
const mcpArgs = isGlobal
  ? ["mcp", "add", "--global", "relay", "--", "bun", "run", join(relayRoot, "src", "index.ts")]
  : ["mcp", "add", "relay", "--", "bun", "run", join(relayRoot, "src", "index.ts")];

Bun.spawnSync(["claude", ...mcpArgs], { stdout: "inherit", stderr: "inherit" });
console.log("[relay] MCP 서버 등록 완료");
console.log("[relay] 설치 완료! 프로젝트에서 /relay-init 을 실행하세요.");
```

- [ ] **Step 3: package.json에 설치 스크립트 추가**

```json
{
  "scripts": {
    "install:global": "bun run scripts/install.ts --global",
    "install:local": "bun run scripts/install.ts"
  }
}
```

- [ ] **Step 4: 전체 설치 테스트**

```bash
# 로컬 설치 테스트
bun run install:local
# .claude/skills/relay.md 존재 확인
ls .claude/skills/
# claude mcp list에 relay 등록 확인
claude mcp list
```

- [ ] **Step 5: Commit**

```bash
git add skills/relay-agent.md scripts/install.ts package.json
git commit -m "feat: /relay-agent 스킬 + 글로벌/로컬 설치 스크립트"
```

---

### Task 21: Claude Code Hooks 설정

**Files:**
- Create: `hooks/post-tool-use.sh`
- Modify: `scripts/install.ts`

hooks는 설치 스크립트가 `.claude/settings.json`에 자동으로 주입한다.

- [ ] **Step 1: PostToolUse 훅 스크립트 작성**

```bash
#!/usr/bin/env bash
# hooks/post-tool-use.sh
# MCP 메시지/태스크/아티팩트 툴 호출 시 대시보드에 agent:status 이벤트 push
# Claude Code는 stdin으로 JSON 주입: { tool_name, tool_input, tool_response, ... }
# MCP 툴의 tool_name 형식: "mcp__relay__send_message" (install.ts의 matcher와 일치해야 함)

RELAY_DASHBOARD_PORT="${RELAY_DASHBOARD_PORT:-3456}"

# stdin에서 페이로드 읽기
PAYLOAD=$(cat)

# 대시보드가 실행 중이면 상태 갱신 요청 (페이로드 그대로 전달)
curl -s -X POST "http://localhost:${RELAY_DASHBOARD_PORT}/api/hook/tool-use" \
  --header "Content-Type: application/json" \
  --data "$PAYLOAD" \
  > /dev/null 2>&1 || true  # 대시보드 미실행 시 무시
```

- [ ] **Step 2: Hono에 `/api/hook/tool-use` 엔드포인트 추가**

```typescript
// src/dashboard/hono.ts 파일 상단 import 추가 (기존 주석 해제):
import { broadcast } from "./websocket";

// 라우트 추가:
app.post("/api/hook/tool-use", async (c) => {
  // Claude Code가 stdin으로 전달하는 페이로드 구조:
  // { tool_name: "mcp__relay__send_message", tool_input: { agent_id: "pm", ... }, ... }
  const body = await c.req.json();
  const agent: string = body.tool_input?.agent_id ?? "unknown";
  broadcast({
    type: "agent:status",
    agentId: agent,
    status: "working",
    timestamp: Date.now(),
  });
  return c.json({ ok: true });
});
```

- [ ] **Step 3: install.ts에 hooks 설정 주입 추가**

설치 시 `.claude/settings.json`에 아래 내용 merge. `install.ts`에 다음 코드를 추가:

먼저 `scripts/install.ts` 상단의 import를 업데이트:
```typescript
// import { cpSync, mkdirSync } from "fs"; — 기존 라인을 아래로 교체
import { cpSync, mkdirSync, readFileSync, writeFileSync, existsSync } from "fs";
```

그 다음, MCP 등록 코드(// 2. MCP 서버 등록) 아래에 추가:
```typescript
// 3. .claude/settings.json에 PostToolUse 훅 설정 주입
const settingsDir = isGlobal
  ? join(process.env.HOME!, ".claude")
  : join(process.cwd(), ".claude");
const settingsPath = join(settingsDir, "settings.json");

const hookScript = join(relayRoot, "hooks", "post-tool-use.sh");
// Claude Code는 MCP 툴 이름을 "mcp__relay__send_message" 형식으로 전달한다.
// matcher는 정규식 substring search이므로 "mcp__relay__"로 relay 툴만 선별적으로 매칭.
const hookEntry = {
  matcher: "mcp__relay__(send_message|create_task|update_task|post_artifact|request_review|submit_review)",
  command: `bash ${hookScript}`,
};

const existing = existsSync(settingsPath)
  ? JSON.parse(readFileSync(settingsPath, "utf-8"))
  : {};

// 기존 PostToolUse 훅 중 relay 것만 교체 (중복 방지)
const existingHooks: { matcher: string; command: string }[] =
  existing.hooks?.PostToolUse ?? [];
const filtered = existingHooks.filter((h) => !h.command.includes("relay"));

const updated = {
  ...existing,
  hooks: {
    ...existing.hooks,
    PostToolUse: [...filtered, hookEntry],
  },
};

mkdirSync(settingsDir, { recursive: true });
writeFileSync(settingsPath, JSON.stringify(updated, null, 2));
console.log(`[relay] 훅 설정 완료: ${settingsPath}`);
```

- [ ] **Step 4: 훅 동작 확인**

```bash
bun run install:local
# MCP 툴 호출 시 대시보드 콘솔에 agent:status 이벤트 수신 확인
```

- [ ] **Step 5: Commit**

```bash
git add hooks/ scripts/install.ts src/dashboard/hono.ts
git commit -m "feat: Claude Code PostToolUse 훅 + 대시보드 연동"
```

---

---

## Chunk 9: 코드 품질 도구

### Task 22: Biome 설정 (lint + format)

**Files:**
- Create: `biome.json`
- Modify: `package.json`

- [ ] **Step 1: Biome 설치**

```bash
bun add --dev @biomejs/biome
bunx biome init
```

- [ ] **Step 2: `biome.json` 설정**

```json
{
  "$schema": "https://biomejs.dev/schemas/1.9.4/schema.json",
  "organizeImports": { "enabled": true },
  "linter": {
    "enabled": true,
    "rules": { "recommended": true }
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "double",
      "semicolons": "always",
      "trailingCommas": "es5"
    }
  },
  "files": {
    "ignore": ["node_modules", "dist", "dashboard/dist", "dashboard/node_modules", "docs-site", "*.db"]
  }
}
```

- [ ] **Step 3: package.json scripts 추가**

```json
{
  "scripts": {
    "lint": "biome lint .",
    "format": "biome format --write .",
    "check": "biome check ."
  }
}
```

- [ ] **Step 4: 전체 소스 check 실행 및 오류 수정**

```bash
bun run check
# 오류 자동 수정
bunx biome check --write .
```

- [ ] **Step 5: Commit**

```bash
git add biome.json package.json
git commit -m "chore: Biome lint + format 설정"
```

---

### Task 23: Husky pre-commit 훅

**Files:**
- Create: `.husky/pre-commit`
- Modify: `package.json`

- [ ] **Step 1: Husky 설치 및 초기화**

```bash
bun add --dev husky
bunx husky init
```

- [ ] **Step 2: `.husky/pre-commit` 작성**

```bash
#!/usr/bin/env sh
# .husky/pre-commit
# 커밋 전 Biome check — lint + format 검사
bun run check
```

- [ ] **Step 3: package.json에 prepare 스크립트 확인**

`husky init`이 자동으로 추가하는 `"prepare": "husky"` 스크립트가 있는지 확인.
없으면 수동 추가:

```json
{
  "scripts": {
    "prepare": "husky"
  }
}
```

- [ ] **Step 4: 훅 동작 확인**

```bash
# format 오류 있는 코드 추가 후 커밋 시도 — Biome가 pre-commit에서 차단하는지 확인
echo "const x=1" > /tmp/test-biome.ts
cp /tmp/test-biome.ts test-biome.ts
git add test-biome.ts
git commit -m "test"  # 이 커밋은 실패해야 함
# 정리
git restore --staged test-biome.ts
rm test-biome.ts
```

- [ ] **Step 5: Commit**

```bash
git add .husky/ package.json
git commit -m "chore: Husky pre-commit 훅 설정 (Biome check)"
```

---

## Chunk 10: CI/CD 파이프라인

### Task 24: GitHub Actions CI

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: CI 워크플로 작성**

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  check:
    name: Lint + Format
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest
      - run: bun install --frozen-lockfile
      - run: bun run check   # biome check

  test:
    name: 테스트
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest
      - run: bun install --frozen-lockfile
      - run: bun test

  build-dashboard:
    name: 대시보드 빌드
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest
      - run: cd dashboard && bun install --frozen-lockfile
      - run: cd dashboard && bun run build
```

- [ ] **Step 2: CI 동작 확인**

```bash
# PR 생성 또는 main push 후 GitHub Actions 탭에서 확인
gh run list
```

- [ ] **Step 3: Commit**

```bash
git add .github/
git commit -m "ci: GitHub Actions CI 파이프라인 구성 (lint + test)"
```

---

## Chunk 11: 문서 사이트

### Task 25: Astro + Starlight 문서 사이트 초기화

**Files:**
- Create: `docs-site/` (Astro + Starlight 프로젝트)
- Create: `.github/workflows/deploy-docs.yml`

Starlight는 Astro 공식 문서 테마. MDX 기반, 사이드바 자동 생성, 검색 내장.

- [ ] **Step 1: Starlight 프로젝트 생성**

```bash
bun create astro@latest docs-site -- --template starlight
cd docs-site
bun install
```

- [ ] **Step 2: `docs-site/astro.config.mjs` 설정**

```javascript
// docs-site/astro.config.mjs
import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";

export default defineConfig({
  // GitHub Pages 배포 시 repo 이름이 base path가 됨
  // GitHub Pages: https://custardcream98.github.io/relay/
  site: "https://custardcream98.github.io",
  base: "/relay",
  integrations: [
    starlight({
      title: "relay",
      description: "Claude Code 위에서 동작하는 멀티 에이전트 협업 프레임워크",
      social: {
        github: "https://github.com/custardcream98/relay",
      },
      sidebar: [
        {
          label: "시작하기",
          items: [
            { label: "소개", link: "/getting-started/introduction" },
            { label: "설치", link: "/getting-started/installation" },
            { label: "빠른 시작", link: "/getting-started/quick-start" },
          ],
        },
        {
          label: "가이드",
          items: [
            { label: "/relay-init — 프로젝트 파악", link: "/guides/relay-init" },
            { label: "/relay — 전체 워크플로", link: "/guides/relay" },
            { label: "/relay-agent — 단일 에이전트", link: "/guides/relay-agent" },
            { label: "에이전트 커스터마이즈", link: "/guides/agents" },
            { label: "워크플로 설정", link: "/guides/workflow" },
            { label: "대시보드", link: "/guides/dashboard" },
          ],
        },
        {
          label: "레퍼런스",
          items: [
            { label: "MCP 툴", link: "/reference/mcp-tools" },
            { label: "agents.yml 스키마", link: "/reference/agents-yml" },
            { label: "워크플로 스키마", link: "/reference/workflow" },
            { label: "메모리 구조", link: "/reference/memory" },
          ],
        },
      ],
    }),
  ],
});
```

- [ ] **Step 3: Commit**

```bash
git add docs-site/
git commit -m "chore: Astro + Starlight 문서 사이트 초기화"
```

---

### Task 26: 문서 콘텐츠 작성

**Files:**
- Create: `docs-site/src/content/docs/getting-started/introduction.mdx`
- Create: `docs-site/src/content/docs/getting-started/installation.mdx`
- Create: `docs-site/src/content/docs/getting-started/quick-start.mdx`
- Create: `docs-site/src/content/docs/guides/relay-init.mdx`
- Create: `docs-site/src/content/docs/guides/relay.mdx`
- Create: `docs-site/src/content/docs/guides/relay-agent.mdx`
- Create: `docs-site/src/content/docs/guides/agents.mdx`
- Create: `docs-site/src/content/docs/guides/workflow.mdx`
- Create: `docs-site/src/content/docs/guides/dashboard.mdx`
- Create: `docs-site/src/content/docs/reference/mcp-tools.mdx`
- Create: `docs-site/src/content/docs/reference/agents-yml.mdx`
- Create: `docs-site/src/content/docs/reference/workflow.mdx`
- Create: `docs-site/src/content/docs/reference/memory.mdx`

- [ ] **Step 1: 소개 페이지 작성**

```mdx
---
title: relay란?
description: Claude Code 위에서 동작하는 멀티 에이전트 협업 프레임워크
---

relay는 Claude Code sub-agent들이 각자의 페르소나(PM, Designer, DA, FE, BE, QA, Deployer)로
실제 스타트업처럼 협업하는 프레임워크다.

추가 API 과금 없이 Claude Code의 Agent 툴만 사용한다.

## 어떻게 동작하나?

```
사용자: "쇼핑카트 기능 추가해줘"
  ↓
[PM]       → 태스크 분해, 이슈 생성
[Designer] → UX 플로우, 컴포넌트 스펙
[DA]       → 이벤트 설계, 성과 지표 정의
[BE]       → API 설계 및 구현
[FE]       → UI 구현
[FE2]      → FE 코드 리뷰
[BE2]      → BE 코드 리뷰
[QA]       → 테스트 시나리오 및 버그 리포트
[Deployer] → 배포
```

## 세 가지 레이어

| 레이어 | 역할 |
|---|---|
| MCP 서버 | 에이전트 간 통신 인프라 (메시지 버스, 태스크 보드, 메모리) |
| Skills | `/relay`, `/relay-init`, `/relay-agent` 오케스트레이션 전략 |
| Hooks | PostToolUse — MCP 툴 호출 시 대시보드 실시간 갱신 |
```

- [ ] **Step 2: 설치 + 빠른 시작 페이지 작성**

```mdx
---
title: 설치
description: relay 설치 방법
---

import { Tabs, TabItem } from "@astrojs/starlight/components";

## 요구사항

- [Claude Code](https://claude.ai/code) 설치 완료
- Bun 1.0 이상

## 설치

<Tabs>
  <TabItem label="글로벌 (권장)">
    ```bash
    git clone https://github.com/custardcream98/relay
    cd relay
    bun install
    bun run install:global
    ```
    모든 프로젝트에서 `/relay` 사용 가능.
  </TabItem>
  <TabItem label="로컬 (프로젝트별)">
    ```bash
    bun run install:local
    ```
    현재 프로젝트에만 설치.
  </TabItem>
</Tabs>
```

- [ ] **Step 3: 가이드 + 레퍼런스 페이지 작성**

각 페이지는 README, CLAUDE.md, skills/*.md 내용을 기반으로 작성.
레퍼런스 페이지는 MCP 툴 스키마, agents.yml 예시, workflow 예시를 포함.

- [ ] **Step 4: 로컬 빌드 확인**

```bash
cd docs-site && bun run dev
```

브라우저에서 `http://localhost:4321` 접속, 사이드바 + 콘텐츠 확인

- [ ] **Step 5: Commit**

```bash
git add docs-site/src/
git commit -m "docs: relay 문서 사이트 콘텐츠 초안 작성"
```

---

### Task 27: GitHub Pages 배포 파이프라인

**Files:**
- Create: `.github/workflows/deploy-docs.yml`
- Modify: `docs-site/astro.config.mjs` (실제 GitHub username/repo 설정)

- [ ] **Step 1: GitHub Pages 활성화**

GitHub 저장소 Settings → Pages → Source: "GitHub Actions" 선택

- [ ] **Step 2: 배포 워크플로 작성**

```yaml
# .github/workflows/deploy-docs.yml
name: 문서 사이트 배포

on:
  push:
    branches: [main]
    paths:
      - "docs-site/**"
      - ".github/workflows/deploy-docs.yml"
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "pages"
  cancel-in-progress: false

jobs:
  build:
    name: 빌드
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest
      - run: cd docs-site && bun install --frozen-lockfile
      - run: cd docs-site && bun run build
      - uses: actions/configure-pages@v4
      - uses: actions/upload-pages-artifact@v3
        with:
          path: docs-site/dist

  deploy:
    name: 배포
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/deploy-pages@v4
        id: deployment
```

- [ ] **Step 3: `docs-site/astro.config.mjs`에 실제 URL 설정**

```javascript
site: "https://custardcream98.github.io",
base: "/relay",
```

- [ ] **Step 4: 배포 확인**

```bash
# main에 push 후
gh run watch
# 완료 후 GitHub Pages URL 접속 확인
```

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/deploy-docs.yml docs-site/astro.config.mjs
git commit -m "ci: GitHub Pages 문서 사이트 자동 배포 파이프라인"
```

---

## 완료 기준

- [ ] `bun test` — 전체 테스트 PASS
- [ ] `bun run check` — Biome lint + format 오류 없음
- [ ] `git commit` 시 pre-commit 훅이 Biome check 실행
- [ ] GitHub Actions CI — PR/push 시 lint + test 자동 실행
- [ ] `bun run src/index.ts` — MCP 서버 + 대시보드 정상 기동
- [ ] `bun run install:local` — 스킬 설치 + MCP 등록 + hooks 설정 완료
- [ ] `/relay-init` — 에이전트들이 프로젝트 파악 후 `.relay/memory/` 생성
- [ ] `/relay "기능 추가"` — 전체 워크플로 실행 (PM → Designer/DA → FE/BE → 리뷰 → QA → Deployer)
- [ ] 대시보드 `http://localhost:3456` — 3패널 실시간 업데이트 + 동적 에이전트 목록
- [ ] 세션 종료 후 `.relay/sessions/YYYY-MM-DD-NNN/` 에 summary.md, tasks.json, messages.json 생성
- [ ] 다음 세션 시작 시 이전 기억이 system prompt에 주입됨
- [ ] `agents.yml`에 커스텀 에이전트 추가 시 대시보드 상태바에 자동 반영
- [ ] PostToolUse 훅으로 MCP 툴 호출 시 대시보드 에이전트 상태 실시간 갱신
- [ ] `bun run docs:dev` — 문서 사이트 로컬 미리보기 가능
- [ ] main push 시 GitHub Pages에 문서 자동 배포
