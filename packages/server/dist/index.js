#!/usr/bin/env node
// src/index.ts
import { createServer } from "node:net";
import { serve } from "@hono/node-server";
import { WebSocketServer } from "ws";

// src/agents/loader.ts
import { existsSync, readFileSync } from "node:fs";
import { join as join2 } from "node:path";

// ../shared/index.ts
var markAsAgentId = (id) => id;

// src/agents/loader.ts
import yaml from "js-yaml";

// src/config.ts
import { isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
var _projectRoot = null;
function setProjectRoot(root) {
  _projectRoot = root;
}
function getProjectRoot() {
  return _projectRoot ?? process.env.RELAY_PROJECT_ROOT ?? process.cwd();
}
function getRelayDir() {
  if (process.env.RELAY_DIR) {
    const dir = resolve(process.env.RELAY_DIR);
    if (!isAbsolute(dir)) throw new Error(`RELAY_DIR resolved to non-absolute path: ${dir}`);
    return dir;
  }
  return join(getProjectRoot(), ".relay");
}
function getInstanceId() {
  return process.env.RELAY_INSTANCE;
}
var _port = null;
function setPort(port) {
  _port = port;
}
function getPort() {
  return _port;
}
function uriToPath(uri) {
  if (uri.startsWith("file://")) {
    return fileURLToPath(uri);
  }
  return uri;
}
var _sessionId = null;
function getSessionId() {
  if (_sessionId !== null) return _sessionId;
  if (process.env.RELAY_SESSION_ID) {
    if (!/^[a-zA-Z0-9_-]+$/.test(process.env.RELAY_SESSION_ID)) {
      console.error(
        "[relay] invalid RELAY_SESSION_ID value; use alphanumeric, hyphen, underscore only"
      );
      process.exit(1);
    }
    _sessionId = process.env.RELAY_SESSION_ID;
    return _sessionId;
  }
  const now = /* @__PURE__ */ new Date();
  const date = now.toISOString().slice(0, 10);
  const hh = String(now.getUTCHours()).padStart(2, "0");
  const mm = String(now.getUTCMinutes()).padStart(2, "0");
  const ss = String(now.getUTCSeconds()).padStart(2, "0");
  const rand = Math.floor(Math.random() * 65536).toString(16).padStart(4, "0");
  _sessionId = `${date}-${hh}${mm}${ss}-${rand}`;
  return _sessionId;
}
function setSessionId(id) {
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
    throw new Error(`setSessionId: invalid session ID format: "${id}"`);
  }
  _sessionId = id;
}

// src/utils/validate.ts
function isValidId(id) {
  return /^[a-zA-Z0-9_-]+$/.test(id);
}

// src/agents/loader.ts
var REGISTERED_MCP_TOOLS = /* @__PURE__ */ new Set([
  "get_server_info",
  "start_session",
  "send_message",
  "get_messages",
  "create_task",
  "update_task",
  "claim_task",
  "get_all_tasks",
  "post_artifact",
  "get_artifact",
  "request_review",
  "submit_review",
  "read_memory",
  "write_memory",
  "append_memory",
  "save_session_summary",
  "list_sessions",
  "get_session_summary",
  "broadcast_thinking",
  "list_agents",
  "list_pool_agents",
  "save_orchestrator_state",
  "get_orchestrator_state"
]);
function validateAgentId(id) {
  if (!isValidId(id)) {
    throw new Error(
      `agent id "${id}" contains invalid characters; use alphanumeric, hyphen, underscore only`
    );
  }
}
function resolveHooks(hooks) {
  const normalize = (val, field) => {
    if (val === void 0) return [];
    if (typeof val === "string") return [val];
    if (Array.isArray(val) && val.every((v) => typeof v === "string")) return val;
    throw new Error(
      `hooks.${field} must be a string or array of strings, got: ${JSON.stringify(val)}`
    );
  };
  return {
    before_task: normalize(hooks.before_task, "before_task"),
    after_task: normalize(hooks.after_task, "after_task")
  };
}
function readYml(path) {
  if (!existsSync(path)) return null;
  return yaml.load(readFileSync(path, "utf-8"));
}
function resolveSharedBlocks(systemPrompt, sharedBlocks, agentId) {
  return systemPrompt.replace(/\{\{([a-zA-Z0-9_-]+)\}\}/g, (_match, blockName) => {
    const block = sharedBlocks[blockName];
    if (block === void 0) {
      throw new Error(
        `shared_blocks reference "{{${blockName}}}" in agent "${agentId}" is not defined. Available blocks: ${Object.keys(sharedBlocks).join(", ") || "(none)"}`
      );
    }
    return block.replace(/\{agent_id\}/g, agentId);
  });
}
function validatePromptSections(agentId, systemPrompt) {
  const requiredSections = [
    { header: "### On Each Spawn", label: "On Each Spawn" },
    { header: "### Declaring End", label: "Declaring End" },
    { header: "## Rules", label: "Rules" }
  ];
  const missing = requiredSections.filter(({ header }) => !systemPrompt.includes(header));
  if (missing.length > 0) {
    throw new Error(
      `agent "${agentId}" systemPrompt is missing required sections: ${missing.map((s) => `"${s.label}"`).join(", ")}. Every agent must include "### On Each Spawn", "### Declaring End", and "## Rules".`
    );
  }
}
function resolveBaseAgents(entries, globalLanguage, poolAgents, sharedBlocks, globalReviewChecklist) {
  const merged = {};
  for (const [id, config] of entries) {
    if (config.disabled) continue;
    if (config.extends) continue;
    validateAgentId(id);
    const language = config.language ?? globalLanguage;
    const review_checklist = config.review_checklist ?? globalReviewChecklist;
    const { name, emoji, tools } = config;
    let systemPrompt = config.systemPrompt ?? poolAgents?.[id]?.systemPrompt;
    if (!name || !emoji || !tools || !systemPrompt) {
      throw new Error(
        `agent "${id}" is missing required fields (name, emoji, tools, systemPrompt). If this is a session-agents file, ensure the agent ID matches a pool entry so systemPrompt can be resolved from the pool.`
      );
    }
    if (sharedBlocks) {
      systemPrompt = resolveSharedBlocks(systemPrompt, sharedBlocks, id);
    }
    const unknownTools = tools.filter((t) => !REGISTERED_MCP_TOOLS.has(t));
    if (unknownTools.length > 0) {
      throw new Error(
        `agent "${id}" lists unknown tools: ${unknownTools.join(", ")}. Valid tools: ${[...REGISTERED_MCP_TOOLS].sort().join(", ")}`
      );
    }
    const persona = {
      id: markAsAgentId(id),
      ...config,
      // Use the resolved systemPrompt (may come from pool fallback when config omits it)
      systemPrompt,
      ...language ? { language } : {},
      ...review_checklist ? { review_checklist } : {}
    };
    if (config.hooks === false || config.hooks == null) {
      persona.hooks = void 0;
    } else if (config.hooks) {
      persona.hooks = resolveHooks(config.hooks);
    }
    merged[id] = persona;
  }
  return merged;
}
function resolveExtendsAgents(entries, merged, globalLanguage, poolAgents, sharedBlocks, globalReviewChecklist) {
  for (const [id, config] of entries) {
    if (config.disabled) continue;
    if (!config.extends) continue;
    validateAgentId(id);
    const language = config.language ?? globalLanguage;
    const base = merged[config.extends] ?? poolAgents?.[config.extends];
    if (!base) {
      throw new Error(
        `extends target "${config.extends}" not found or is disabled` + (poolAgents ? " (searched current file and pool)" : "")
      );
    }
    const review_checklist = config.review_checklist ?? base.review_checklist ?? globalReviewChecklist;
    const configOverrides = Object.fromEntries(
      Object.entries(config).filter(([, v]) => v !== void 0)
    );
    let resolvedSystemPrompt;
    if (config.systemPrompt && sharedBlocks) {
      resolvedSystemPrompt = resolveSharedBlocks(config.systemPrompt, sharedBlocks, id);
    }
    const merged_persona = {
      ...base,
      ...configOverrides,
      id: markAsAgentId(id),
      extends: void 0,
      basePersonaId: config.extends,
      // preserve the base persona ID before clearing extends
      ...language ? { language } : {},
      ...review_checklist ? { review_checklist } : {},
      // Use resolved systemPrompt if the extends agent overrides it with shared_blocks
      ...resolvedSystemPrompt ? { systemPrompt: resolvedSystemPrompt } : {}
    };
    const configHooks = configOverrides.hooks;
    if (configHooks === false) {
      merged_persona.hooks = void 0;
    } else if (configHooks != null) {
      merged_persona.hooks = resolveHooks(configHooks);
    }
    merged[id] = merged_persona;
  }
}
function loadAgents(override, poolAgents) {
  const entries = Object.entries(override.agents);
  const globalLanguage = override.language;
  const sharedBlocks = override.shared_blocks;
  const globalReviewChecklist = override.review_checklist;
  const merged = resolveBaseAgents(
    entries,
    globalLanguage,
    poolAgents,
    sharedBlocks,
    globalReviewChecklist
  );
  resolveExtendsAgents(
    entries,
    merged,
    globalLanguage,
    poolAgents,
    sharedBlocks,
    globalReviewChecklist
  );
  return merged;
}
function loadPool(override) {
  if (override) {
    const agents = loadAgents(override);
    for (const [id, persona] of Object.entries(agents)) {
      validatePromptSections(id, persona.systemPrompt);
    }
    return agents;
  }
  const poolFile = readYml(join2(getRelayDir(), "agents.pool.yml")) ?? readYml(join2(getProjectRoot(), "agents.pool.yml"));
  if (poolFile) {
    return loadPool(poolFile);
  }
  throw new Error(
    "No agent pool configured. Create .relay/agents.pool.yml (see agents.pool.example.yml) or run /relay:relay to auto-generate one."
  );
}

// src/dashboard/hono.ts
import { access, readFile as readFile2 } from "node:fs/promises";
import { dirname, join as join5 } from "node:path";
import { fileURLToPath as fileURLToPath2 } from "node:url";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { cors } from "hono/cors";

// src/agents/cache.ts
import { existsSync as existsSync2, readFileSync as readFileSync2 } from "node:fs";
import { join as join3 } from "node:path";
import yaml2 from "js-yaml";
var POOL_CACHE_TTL_MS = 5 * 60 * 1e3;
var agentsCache = /* @__PURE__ */ new Map();
var pool = null;
var poolCachedAt = 0;
function getAgents(sessionId) {
  if (sessionId && !/^[a-zA-Z0-9_-]+$/.test(sessionId)) {
    return null;
  }
  const cacheKey = sessionId ?? "__default__";
  if (agentsCache.has(cacheKey)) return agentsCache.get(cacheKey);
  let result;
  try {
    if (sessionId) {
      const sessionFile = join3(getRelayDir(), `session-agents-${sessionId}.yml`);
      if (existsSync2(sessionFile)) {
        const parsed = yaml2.load(readFileSync2(sessionFile, "utf-8"));
        if (!parsed) {
          console.error(`[relay] session file is empty or malformed: ${sessionFile}`);
        }
        let poolAgents;
        try {
          poolAgents = getPool();
        } catch {
          poolAgents = void 0;
        }
        result = loadAgents(parsed ?? { agents: {} }, poolAgents);
      } else {
        console.error(`[relay] session file not found: ${sessionFile}`);
        return null;
      }
    } else {
      result = {};
    }
  } catch (err) {
    console.error(
      `[relay] failed to load agents for session "${sessionId ?? "__default__"}":`,
      err.message
    );
    return null;
  }
  agentsCache.set(cacheKey, result);
  return result;
}
function getPool() {
  const now = Date.now();
  if (pool !== null && now - poolCachedAt < POOL_CACHE_TTL_MS) {
    return pool;
  }
  pool = loadPool();
  poolCachedAt = now;
  return pool;
}

// src/store.ts
var MAX_MESSAGES_PER_SESSION = 1e4;
var MAX_TASKS_PER_SESSION = 1e3;
var MAX_ARTIFACTS_PER_SESSION = 500;
var MAX_REVIEWS_PER_SESSION = 500;
var MAX_EVENTS_PER_SESSION = 1e5;
var MAX_TASK_DEPTH = 1;
var MAX_DERIVED_SIBLINGS = 3;
var messages = [];
var messageSeq = 0;
var messageCountBySession = /* @__PURE__ */ new Map();
var tasks = [];
var taskCountBySession = /* @__PURE__ */ new Map();
var artifacts = [];
var artifactCountBySession = /* @__PURE__ */ new Map();
var reviews = [];
var reviewCountBySession = /* @__PURE__ */ new Map();
var events = [];
var eventCountBySession = /* @__PURE__ */ new Map();
function nowSeconds() {
  return Math.floor(Date.now() / 1e3);
}
function insertMessage(msg) {
  const sessionCount = messageCountBySession.get(msg.session_id) ?? 0;
  if (sessionCount >= MAX_MESSAGES_PER_SESSION) {
    throw new Error(`session message limit reached (max ${MAX_MESSAGES_PER_SESSION} per session)`);
  }
  const seq = ++messageSeq;
  const created_at = nowSeconds();
  messages.push({ ...msg, metadata: msg.metadata ?? null, created_at, seq });
  messageCountBySession.set(msg.session_id, sessionCount + 1);
  return { seq, created_at };
}
function getMessagesForAgent(sessionId, agentId, afterSeq) {
  return messages.filter(
    (m) => m.session_id === sessionId && (m.to_agent === agentId || m.to_agent === null) && (afterSeq === void 0 || m.seq > afterSeq)
  );
}
function getAllMessages(sessionId) {
  return messages.filter((m) => m.session_id === sessionId);
}
function insertTask(task) {
  const sessionCount = taskCountBySession.get(task.session_id) ?? 0;
  if (sessionCount >= MAX_TASKS_PER_SESSION) {
    throw new Error(`session task limit reached (max ${MAX_TASKS_PER_SESSION} per session)`);
  }
  const ts = nowSeconds();
  tasks.push({
    ...task,
    depends_on: task.depends_on ?? [],
    depth: task.depth ?? 0,
    parent_task_id: task.parent_task_id ?? null,
    derived_reason: task.derived_reason ?? null,
    created_at: ts,
    updated_at: ts
  });
  taskCountBySession.set(task.session_id, sessionCount + 1);
}
function updateTask(id, sessionId, updates) {
  if (Object.keys(updates).length === 0) return false;
  const task = tasks.find((t) => t.id === id && t.session_id === sessionId);
  if (!task) return false;
  if ("status" in updates && updates.status !== void 0) task.status = updates.status;
  if ("assignee" in updates) task.assignee = updates.assignee ?? null;
  if ("description" in updates) task.description = updates.description ?? null;
  task.updated_at = nowSeconds();
  return true;
}
function getTaskById(id, sessionId) {
  return tasks.find((t) => t.id === id && t.session_id === sessionId) ?? null;
}
function getTaskByExternalId(sessionId, externalId) {
  return tasks.find((t) => t.session_id === sessionId && t.external_id === externalId) ?? null;
}
function getAllTasks(sessionId, status, assignee) {
  return tasks.filter(
    (t) => t.session_id === sessionId && (status === void 0 || t.status === status) && (assignee === void 0 || t.assignee === assignee)
  );
}
function claimTask(taskId, agentId, sessionId) {
  const task = tasks.find(
    (t) => t.id === taskId && t.session_id === sessionId && t.status === "todo" && (t.assignee === agentId || t.assignee === null)
  );
  if (!task) return false;
  task.status = "in_progress";
  if (task.assignee === null) task.assignee = agentId;
  task.updated_at = nowSeconds();
  return true;
}
function countDerivedSiblings(sessionId, parentTaskId) {
  return tasks.filter((t) => t.session_id === sessionId && t.parent_task_id === parentTaskId).length;
}
function insertArtifact(artifact) {
  const sessionCount = artifactCountBySession.get(artifact.session_id) ?? 0;
  if (sessionCount >= MAX_ARTIFACTS_PER_SESSION) {
    throw new Error(
      `session artifact limit reached (max ${MAX_ARTIFACTS_PER_SESSION} per session)`
    );
  }
  artifacts.push({ ...artifact, created_at: nowSeconds() });
  artifactCountBySession.set(artifact.session_id, sessionCount + 1);
}
function getArtifactById(id, sessionId) {
  return artifacts.find((a) => a.id === id && a.session_id === sessionId) ?? null;
}
function getArtifactByName(sessionId, name) {
  const matches = artifacts.map((a, idx) => ({ a, idx })).filter(({ a }) => a.session_id === sessionId && a.name === name).sort((x, y) => y.a.created_at - x.a.created_at || y.idx - x.idx);
  return matches[0]?.a ?? null;
}
function getAllArtifacts(sessionId) {
  return artifacts.filter((a) => a.session_id === sessionId);
}
function insertReview(review) {
  const sessionCount = reviewCountBySession.get(review.session_id) ?? 0;
  if (sessionCount >= MAX_REVIEWS_PER_SESSION) {
    throw new Error(`session review limit reached (max ${MAX_REVIEWS_PER_SESSION} per session)`);
  }
  const ts = nowSeconds();
  reviews.push({ ...review, created_at: ts, updated_at: ts });
  reviewCountBySession.set(review.session_id, sessionCount + 1);
}
function updateReviewStatus(id, sessionId, status, comments) {
  const review = reviews.find((r) => r.id === id && r.session_id === sessionId);
  if (review) {
    review.status = status;
    review.comments = comments;
    review.updated_at = nowSeconds();
  }
}
function getReviewById(id, sessionId) {
  return reviews.find((r) => r.id === id && r.session_id === sessionId) ?? null;
}
function insertEvent(sessionId, eventPayload, type, agentId, timestampMs) {
  const sessionCount = eventCountBySession.get(sessionId) ?? 0;
  if (sessionCount >= MAX_EVENTS_PER_SESSION) {
    return;
  }
  events.push({
    id: crypto.randomUUID(),
    session_id: sessionId,
    type,
    agent_id: agentId,
    payload: eventPayload,
    created_at: Math.floor(timestampMs / 1e3)
  });
  eventCountBySession.set(sessionId, sessionCount + 1);
}
function getAllSessions(limit = 20) {
  const sessionMap = /* @__PURE__ */ new Map();
  for (const e of events) {
    const existing = sessionMap.get(e.session_id);
    if (!existing) {
      sessionMap.set(e.session_id, { created_at: e.created_at, count: 1 });
    } else {
      if (e.created_at < existing.created_at) existing.created_at = e.created_at;
      existing.count++;
    }
  }
  return [...sessionMap.entries()].map(([id, { created_at, count }]) => ({ id, created_at, event_count: count })).sort((a, b) => b.created_at - a.created_at).slice(0, limit);
}
var orchestratorStates = /* @__PURE__ */ new Map();
function saveOrchestratorState(sessionId, state) {
  orchestratorStates.set(sessionId, state);
}
function getOrchestratorState(sessionId) {
  return orchestratorStates.get(sessionId) ?? null;
}

// src/tools/sessions.ts
import { existsSync as existsSync3, mkdirSync, readdirSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { join as join4 } from "node:path";
async function handleSaveSessionSummary(relayDir, input) {
  if (!isValidId(input.session_id)) {
    return { success: false, error: "invalid ID format" };
  }
  try {
    const dir = join4(relayDir, "sessions", input.session_id);
    mkdirSync(dir, { recursive: true });
    await writeFile(join4(dir, "summary.md"), `${input.summary}
`);
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}
async function handleListSessions(relayDir) {
  try {
    const sessionsDir = join4(relayDir, "sessions");
    if (!existsSync3(sessionsDir)) return { success: true, sessions: [] };
    const sessions = readdirSync(sessionsDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort().reverse();
    return { success: true, sessions };
  } catch (err) {
    return { success: false, sessions: [], error: String(err) };
  }
}
async function handleGetSessionSummary(relayDir, input) {
  if (!isValidId(input.session_id)) {
    return { success: false, error: "invalid ID format" };
  }
  try {
    const summaryPath = join4(relayDir, "sessions", input.session_id, "summary.md");
    if (!existsSync3(summaryPath)) return { success: false, error: "session not found" };
    return { success: true, summary: await readFile(summaryPath, "utf-8") };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}
function handleSaveOrchestratorState(sessionId, input) {
  saveOrchestratorState(sessionId, input.state);
  return { success: true };
}
function handleGetOrchestratorState(sessionId, _input) {
  const state = getOrchestratorState(sessionId);
  return { success: true, state };
}

// src/utils/broadcast.ts
function taskToPayload(task) {
  return {
    id: task.id,
    title: task.title,
    assignee: task.assignee,
    status: task.status,
    priority: task.priority,
    description: task.description,
    depends_on: task.depends_on ?? [],
    parent_task_id: task.parent_task_id ?? null,
    depth: task.depth ?? 0,
    derived_reason: task.derived_reason ?? null,
    created_at: task.created_at,
    updated_at: task.updated_at
  };
}

// src/dashboard/utils.ts
function isLocalhostOrigin(origin) {
  if (!origin) return false;
  try {
    const url = new URL(origin);
    return url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]";
  } catch {
    return false;
  }
}

// src/dashboard/websocket.ts
var clients = /* @__PURE__ */ new Set();
var MAX_WS_CLIENTS = 50;
function addClient(ws) {
  if (clients.size >= MAX_WS_CLIENTS) {
    return false;
  }
  clients.add(ws);
  return true;
}
function removeClient(ws) {
  clients.delete(ws);
}
function broadcast(event) {
  if (event.type !== "session:started" && event.type !== "agent:thinking") {
    try {
      insertEvent(
        getSessionId(),
        JSON.stringify(event),
        event.type,
        "agentId" in event ? event.agentId : null,
        event.timestamp
      );
    } catch (err) {
      console.error("[relay] failed to persist event:", err);
    }
  }
  const data = JSON.stringify(event);
  for (const client of clients) {
    try {
      client.send(data);
    } catch {
      clients.delete(client);
    }
  }
}
var PING_INTERVAL_MS = 3e4;
var alive = /* @__PURE__ */ new WeakMap();
function markClientAlive(ws) {
  alive.set(ws, true);
}
function startHeartbeat() {
  return setInterval(() => {
    for (const ws of clients) {
      if (alive.get(ws) === false) {
        ws.terminate();
        clients.delete(ws);
        continue;
      }
      alive.set(ws, false);
      try {
        ws.ping();
      } catch {
        clients.delete(ws);
      }
    }
  }, PING_INTERVAL_MS);
}

// src/dashboard/hono.ts
var DASHBOARD_DIST = process.env.RELAY_DASHBOARD_DIR ?? join5(dirname(fileURLToPath2(import.meta.url)), "dashboard");
var app = new Hono();
app.use(
  "/api/*",
  cors({
    origin: (origin) => {
      if (!origin) return origin;
      return isLocalhostOrigin(origin) ? origin : null;
    },
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type"]
  })
);
app.use("/assets/*", serveStatic({ root: DASHBOARD_DIST }));
app.get("/api/agents", (c) => {
  try {
    let agents;
    try {
      agents = getPool();
    } catch {
      agents = {};
    }
    return c.json(
      Object.values(agents).map((a) => ({
        id: a.id,
        name: a.name,
        emoji: a.emoji,
        description: a.description,
        basePersonaId: a.basePersonaId
        // expose for dashboard agent disambiguation
      }))
    );
  } catch (err) {
    console.error("[relay] internal error:", err);
    return c.json({ success: false, error: "Internal server error" }, 500);
  }
});
app.get("/api/health", (c) => {
  return c.json({
    ok: true,
    sessionId: getSessionId(),
    instanceId: getInstanceId() ?? null,
    port: getPort(),
    uptime: Math.floor(process.uptime())
  });
});
app.get("/api/session", (c) => {
  try {
    const sessionId = getSessionId();
    const offset = Math.max(0, Number(c.req.query("offset") ?? 0) || 0);
    const limit = Math.min(500, Math.max(1, Number(c.req.query("limit") ?? 500) || 500));
    const allTasks = getAllTasks(sessionId);
    const allMessages = getAllMessages(sessionId);
    const allArtifacts = getAllArtifacts(sessionId);
    const taskPayloads = allTasks.slice(offset, offset + limit).map(taskToPayload);
    return c.json({
      tasks: taskPayloads,
      messages: allMessages.slice(offset, offset + limit).map(({ session_id: _s, seq: _q, ...m }) => ({ ...m, metadata: m.metadata ?? null })),
      artifacts: allArtifacts.map(
        ({ session_id: _s, content: _c, task_id: _t, created_at: _ca, ...a }) => a
      ),
      // Pagination metadata — lets the dashboard detect truncation
      total: {
        tasks: allTasks.length,
        messages: allMessages.length,
        artifacts: allArtifacts.length
      }
    });
  } catch (err) {
    console.error("[relay] internal error:", err);
    return c.json({ success: false, error: "Internal server error" }, 500);
  }
});
app.get("/api/artifacts/:id", (c) => {
  const artifactId = c.req.param("id");
  if (!/^[a-zA-Z0-9_-]+$/.test(artifactId)) {
    return c.json({ success: false, error: "Invalid artifact ID" }, 400);
  }
  const sessionId = getSessionId();
  const artifact = getArtifactById(artifactId, sessionId);
  if (!artifact) {
    return c.json({ success: false, error: "Artifact not found" }, 404);
  }
  const { session_id: _, ...rest } = artifact;
  return c.json({ success: true, artifact: rest });
});
app.get("/api/sessions/live", (c) => {
  try {
    const sessions = getAllSessions(50);
    return c.json({ success: true, sessions });
  } catch (err) {
    console.error("[relay] internal error:", err);
    return c.json({ success: false, error: "Internal server error" }, 500);
  }
});
app.get("/api/sessions", async (c) => {
  const result = await handleListSessions(getRelayDir());
  return c.json(result);
});
app.get("/api/sessions/:id/completion-check", (c) => {
  const sessionId = c.req.param("id");
  if (!/^[a-zA-Z0-9_-]+$/.test(sessionId)) {
    return c.json({ error: "Invalid session ID" }, 400);
  }
  try {
    const allTasks = getAllTasks(sessionId);
    const totalCount = allTasks.length;
    const doneCount = allTasks.filter((t) => t.status === "done").length;
    const allDone = totalCount > 0 && doneCount === totalCount;
    const pendingTasks = allTasks.filter((t) => t.status !== "done").map(({ id, title, status, assignee }) => ({ id, title, status, assignee }));
    return c.json({
      success: true,
      all_done: allDone,
      done_count: doneCount,
      total_count: totalCount,
      pending_tasks: pendingTasks
    });
  } catch (err) {
    console.error("[relay] internal error:", err);
    return c.json({ success: false, error: "Internal server error" }, 500);
  }
});
app.get("/api/sessions/:id", async (c) => {
  const sessionId = c.req.param("id");
  if (!/^[a-zA-Z0-9_-]+$/.test(sessionId)) {
    return c.json({ error: "Invalid session ID" }, 400);
  }
  const result = await handleGetSessionSummary(getRelayDir(), { session_id: sessionId });
  if (!result.success) return c.json({ success: false, error: result.error }, 404);
  return c.json(result);
});
var MAX_SEEN_SESSIONS = 10;
var seenAgentIdsBySession = /* @__PURE__ */ new Map();
app.post("/api/hook/tool-use", async (c) => {
  const origin = c.req.header("origin");
  if (origin && !isLocalhostOrigin(origin)) {
    return c.json({ error: "forbidden" }, 403);
  }
  const contentLength = Number(c.req.header("content-length") ?? 0);
  if (contentLength > 65536) {
    return c.json({ error: "payload too large" }, 413);
  }
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid JSON payload" }, 400);
  }
  const rawAgentId = body?.tool_input?.agent_id;
  const agentId = typeof rawAgentId === "string" && /^[a-zA-Z0-9_-]+$/.test(rawAgentId) && rawAgentId.length <= 64 ? rawAgentId : "unknown";
  const now = Date.now();
  const currentSessionId = getSessionId();
  if (agentId !== "unknown") {
    let seenInSession = seenAgentIdsBySession.get(currentSessionId);
    if (!seenInSession) {
      seenInSession = /* @__PURE__ */ new Set();
      seenAgentIdsBySession.set(currentSessionId, seenInSession);
      if (seenAgentIdsBySession.size > MAX_SEEN_SESSIONS) {
        const oldestKey = seenAgentIdsBySession.keys().next().value;
        if (oldestKey !== void 0) seenAgentIdsBySession.delete(oldestKey);
      }
    }
    if (!seenInSession.has(agentId)) {
      seenInSession.add(agentId);
      broadcast({
        type: "agent:joined",
        agentId: markAsAgentId(agentId),
        sessionId: currentSessionId,
        timestamp: now
      });
    }
  }
  broadcast({
    type: "agent:status",
    agentId: markAsAgentId(agentId),
    status: "working",
    timestamp: now
  });
  return c.json({ ok: true });
});
app.get("*", async (_c) => {
  const indexPath = join5(DASHBOARD_DIST, "index.html");
  try {
    await access(indexPath);
  } catch {
    return new Response("Dashboard not built. Run: bun run dashboard:build", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" }
    });
  }
  const content = await readFile2(indexPath);
  return new Response(content, { headers: { "Content-Type": "text/html; charset=utf-8" } });
});

// src/mcp.ts
import { createRequire } from "node:module";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

// src/tools/register-agents.ts
import { z as z2 } from "zod";

// src/schemas.ts
import { z } from "zod";
var AGENT_ID_SCHEMA = z.string().regex(/^[a-zA-Z0-9_-]+$/).max(64);

// src/tools/register-agents.ts
function registerAgentTools(server2) {
  server2.tool(
    "get_server_info",
    {
      agent_id: AGENT_ID_SCHEMA.describe("ID of the calling agent (for tracking)")
    },
    async () => {
      const port = getPort();
      const dashboardUrl = port != null ? `http://localhost:${port}` : null;
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: true,
              dashboardUrl,
              dashboardAvailable: port != null,
              port,
              sessionId: getSessionId(),
              instanceId: getInstanceId() ?? null
            })
          }
        ]
      };
    }
  );
  server2.tool(
    "broadcast_thinking",
    {
      agent_id: AGENT_ID_SCHEMA.describe(
        "ID of the agent sharing their thinking. Sets the agent's status to 'working' in the dashboard."
      ),
      content: z2.string().max(65536).describe(
        "What the agent is currently thinking or about to do. Streamed to the Agent Thoughts panel in the dashboard."
      )
    },
    async (input) => {
      const agentId = markAsAgentId(input.agent_id);
      const timestamp = Date.now();
      broadcast({ type: "agent:status", agentId, status: "working", timestamp });
      broadcast({ type: "agent:thinking", agentId, chunk: input.content, timestamp });
      return { content: [{ type: "text", text: JSON.stringify({ success: true }) }] };
    }
  );
  server2.tool(
    "list_agents",
    {
      agent_id: AGENT_ID_SCHEMA.describe("ID of the calling agent (for tracking)"),
      session_id: z2.string().regex(/^[a-zA-Z0-9_-]+$/).max(128).optional().describe(
        "Session ID to scope agent loading. When provided, loads .relay/session-agents-{session_id}.yml (written by /relay:relay Team Composition)."
      )
    },
    async (input) => {
      const agents = getAgents(input.session_id);
      if (agents === null) {
        const relayDir = getRelayDir();
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: false,
                error: `Session agents file not found: ${relayDir}/session-agents-${input.session_id}.yml \u2014 run team composition first`
              })
            }
          ]
        };
      }
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: true,
              agents: Object.values(agents).map((a) => ({
                id: a.id,
                name: a.name,
                emoji: a.emoji,
                description: a.description,
                tools: a.tools,
                // Language directive is already injected by buildSystemPromptWithMemory() in loader.ts.
                // Return the raw systemPrompt here to avoid duplicating the directive.
                systemPrompt: a.systemPrompt,
                basePersonaId: a.basePersonaId,
                // expose for dashboard agent disambiguation
                validate_prompt: a.validate_prompt,
                review_checklist: a.review_checklist
              }))
            })
          }
        ]
      };
    }
  );
  server2.tool(
    "list_pool_agents",
    {
      agent_id: AGENT_ID_SCHEMA.describe("ID of the calling agent (for tracking)")
    },
    async () => {
      let agents;
      try {
        agents = getPool();
      } catch (err) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ success: false, error: err.message })
            }
          ]
        };
      }
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: true,
              agents: Object.values(agents).map((a) => ({
                id: a.id,
                name: a.name,
                emoji: a.emoji,
                description: a.description,
                tags: a.tags,
                tools: a.tools,
                validate_prompt: a.validate_prompt,
                review_checklist: a.review_checklist
                // systemPrompt intentionally omitted — pool metadata only
              }))
            })
          }
        ]
      };
    }
  );
}

// src/tools/register-artifacts.ts
import { z as z3 } from "zod";

// src/tools/artifacts.ts
function handlePostArtifact(sessionId, input) {
  try {
    const id = crypto.randomUUID();
    insertArtifact({
      id,
      session_id: sessionId,
      name: input.name,
      type: input.type,
      content: input.content,
      created_by: input.agent_id,
      task_id: input.task_id ?? null
    });
    return { success: true, artifact_id: id };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}
function handleGetArtifact(sessionId, input) {
  try {
    const artifact = getArtifactByName(sessionId, input.name);
    if (!artifact) {
      return {
        success: false,
        artifact: null,
        error: "artifact not found"
      };
    }
    return { success: true, artifact };
  } catch (err) {
    return { success: false, artifact: null, error: String(err) };
  }
}

// src/tools/register-artifacts.ts
function registerArtifactTools(server2) {
  server2.tool(
    "post_artifact",
    {
      agent_id: AGENT_ID_SCHEMA.describe("ID of the agent posting the artifact."),
      name: z3.string().max(256).describe(
        "Unique artifact name within the session (e.g. login-design, cart-fe-pr). Used by get_artifact to retrieve it."
      ),
      type: z3.enum(["figma_spec", "pr", "report", "analytics_plan", "design", "document"]).describe("Artifact type. Choose the closest match to the content being stored."),
      content: z3.string().max(524288).describe("Artifact content (JSON, Markdown, or plain text). Max 512 KB."),
      task_id: z3.string().max(128).optional().describe("ID of the task this artifact fulfills. Links the artifact to a task card.")
    },
    async (input) => {
      const result = await handlePostArtifact(getSessionId(), input);
      if (result.success && result.artifact_id) {
        broadcast({
          type: "artifact:posted",
          artifact: {
            id: result.artifact_id,
            name: input.name,
            type: input.type,
            created_by: input.agent_id
          },
          timestamp: Date.now()
        });
      }
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    }
  );
  server2.tool(
    "get_artifact",
    {
      agent_id: AGENT_ID_SCHEMA.describe("ID of the agent fetching the artifact."),
      name: z3.string().max(256).describe("Name of the artifact to retrieve. Must match the name used in post_artifact.")
    },
    async (input) => {
      const result = await handleGetArtifact(getSessionId(), input);
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    }
  );
}

// src/tools/register-memory.ts
import { z as z4 } from "zod";

// src/tools/memory.ts
import { existsSync as existsSync4, mkdirSync as mkdirSync2 } from "node:fs";
import { appendFile, readFile as readFile3, rename, unlink, writeFile as writeFile2 } from "node:fs/promises";
import { join as join6 } from "node:path";
function isValidMemoryKey(key) {
  return key.length > 0 && key.length <= 256 && !key.startsWith("#") && !key.includes("\n") && !key.includes("\r");
}
function agentMemoryPath(relayDir, agentId) {
  return join6(relayDir, "memory", "agents", `${agentId}.md`);
}
function projectMemoryPath(relayDir) {
  return join6(relayDir, "memory", "project.md");
}
function ensureDir(relayDir) {
  mkdirSync2(join6(relayDir, "memory", "agents"), { recursive: true });
}
async function handleReadMemory(relayDir, input) {
  if (input.agent_id !== void 0 && !isValidId(input.agent_id)) {
    return { success: false, content: null, error: "invalid ID format" };
  }
  try {
    if (!input.agent_id) {
      const project = existsSync4(projectMemoryPath(relayDir)) ? await readFile3(projectMemoryPath(relayDir), "utf-8") : null;
      return { success: true, content: project };
    }
    const path = agentMemoryPath(relayDir, input.agent_id);
    if (!existsSync4(path)) return { success: true, content: null };
    return { success: true, content: await readFile3(path, "utf-8") };
  } catch (err) {
    return { success: false, content: null, error: String(err) };
  }
}
async function handleWriteMemory(relayDir, input) {
  if (input.agent_id !== void 0 && !isValidId(input.agent_id)) {
    return { success: false, error: "invalid ID format" };
  }
  if (!isValidMemoryKey(input.key)) {
    return { success: false, error: "invalid key format (newlines not allowed)" };
  }
  try {
    ensureDir(relayDir);
    const path = input.agent_id ? agentMemoryPath(relayDir, input.agent_id) : projectMemoryPath(relayDir);
    const existing = existsSync4(path) ? await readFile3(path, "utf-8") : "";
    const lines = existing.split("\n");
    const headerLine = `## ${input.key}`;
    const startIdx = lines.indexOf(headerLine);
    let newContent;
    if (startIdx === -1) {
      const suffix = `${existing.length > 0 ? "\n" : ""}## ${input.key}

${input.content}`;
      newContent = `${(existing.trimEnd() + suffix).trimEnd()}
`;
    } else {
      let endIdx = lines.findIndex((l, i) => i > startIdx && l.startsWith("## "));
      if (endIdx === -1) endIdx = lines.length;
      const before = lines.slice(0, startIdx);
      const after = lines.slice(endIdx);
      const newSection = [`## ${input.key}`, "", input.content.trimEnd()];
      const merged = [...before, ...newSection, ...after].join("\n");
      newContent = `${merged.trimEnd()}
`;
    }
    const tmpPath = `${path}.${crypto.randomUUID()}.tmp`;
    await writeFile2(tmpPath, newContent);
    try {
      await rename(tmpPath, path);
    } catch (err) {
      try {
        await unlink(tmpPath);
      } catch {
      }
      throw err;
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}
async function handleAppendMemory(relayDir, input) {
  const agentId = input.agent_id;
  if (agentId === void 0) {
    return {
      success: false,
      error: "append_memory without agent_id is no longer supported. Use save_session_summary to persist session retrospectives."
    };
  }
  if (!isValidId(input.agent_id)) {
    return { success: false, error: "invalid ID format" };
  }
  try {
    ensureDir(relayDir);
    const path = agentMemoryPath(relayDir, input.agent_id);
    const timestamp = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    const entry = `
---
_${timestamp}_

${input.content}
`;
    await appendFile(path, entry);
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// src/tools/register-memory.ts
function registerMemoryTools(server2) {
  server2.tool(
    "read_memory",
    {
      agent_id: AGENT_ID_SCHEMA.optional().describe("Agent ID. Omit to return project.md only.")
    },
    async (input) => {
      const result = await handleReadMemory(getRelayDir(), input);
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    }
  );
  server2.tool(
    "write_memory",
    {
      agent_id: AGENT_ID_SCHEMA.optional().describe("Agent ID. Omit to write to project.md"),
      key: z4.string().min(1).max(256).regex(/^[^#\n\r][^\n\r]*$/, "key must not start with '#' and must not contain newlines").describe("Memory section key (e.g. conventions, api-patterns)"),
      content: z4.string().max(131072).describe("Content to store")
    },
    async (input) => {
      const result = await handleWriteMemory(getRelayDir(), input);
      if (result.success) {
        broadcast({
          type: "memory:updated",
          agentId: markAsAgentId(input.agent_id ?? "unknown"),
          timestamp: Date.now()
        });
      }
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    }
  );
  server2.tool(
    "append_memory",
    {
      agent_id: AGENT_ID_SCHEMA.describe(
        "Agent ID. Use save_session_summary for session retrospectives."
      ),
      content: z4.string().max(131072).describe("Content to append")
    },
    async (input) => {
      const result = await handleAppendMemory(getRelayDir(), input);
      if (result.success) {
        broadcast({
          type: "memory:updated",
          agentId: markAsAgentId(input.agent_id),
          timestamp: Date.now()
        });
      }
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    }
  );
}

// src/tools/register-messaging.ts
import { z as z5 } from "zod";

// src/tools/messaging.ts
function handleSendMessage(sessionId, input) {
  try {
    const id = crypto.randomUUID();
    const msg = {
      id,
      session_id: sessionId,
      from_agent: input.agent_id,
      to_agent: input.to ?? null,
      content: input.content,
      thread_id: input.thread_id ?? null,
      metadata: input.metadata ?? null
    };
    const { seq, created_at } = insertMessage(msg);
    return {
      success: true,
      message_id: id,
      message: { ...msg, created_at, seq }
    };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}
function handleGetMessages(sessionId, input) {
  try {
    const messages2 = getMessagesForAgent(sessionId, input.agent_id, input.after_seq);
    const filtered = messages2.filter(
      (m) => !(m.to_agent === null && m.from_agent === input.agent_id)
    );
    return { success: true, messages: filtered };
  } catch (err) {
    return { success: false, messages: [], error: String(err) };
  }
}

// src/tools/register-messaging.ts
function registerMessagingTools(server2) {
  server2.tool(
    "send_message",
    {
      agent_id: AGENT_ID_SCHEMA.describe(
        "ID of the sending agent (e.g. pm, fe, be, qa). Must be alphanumeric, hyphen, or underscore."
      ),
      to: z5.string().regex(/^[a-zA-Z0-9_-]+$/).max(64).nullable().optional().describe(
        "ID of the recipient agent. Set to null or omit to broadcast to all agents in the session."
      ),
      content: z5.string().max(65536).describe("Message content (plain text or Markdown)."),
      thread_id: z5.string().regex(/^[a-zA-Z0-9_-]+$/).max(256).optional().describe("Thread ID to group related messages (e.g. a task ID or review ID). Optional."),
      metadata: z5.record(z5.string().max(64), z5.string().max(1024)).refine((obj) => Object.keys(obj).length <= 20, { message: "metadata: max 20 keys" }).optional().describe(
        "Optional key-value pairs for structured context (e.g. { task_id: 'abc', severity: 'high' }). Values must be strings."
      )
    },
    async (input) => {
      const result = await handleSendMessage(getSessionId(), input);
      if (result.success) {
        const { id, from_agent, to_agent, content, thread_id, metadata, created_at } = result.message;
        broadcast({
          type: "message:new",
          message: { id, from_agent, to_agent, content, thread_id, metadata, created_at },
          timestamp: Date.now()
        });
      }
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    }
  );
  server2.tool(
    "get_messages",
    {
      agent_id: AGENT_ID_SCHEMA.describe(
        "ID of the agent fetching messages. Returns messages addressed to this agent plus all broadcasts (excluding own)."
      ),
      after_seq: z5.number().int().optional().describe(
        "Sequence cursor. When provided, only messages with seq greater than this value are returned. Pass the seq of your last received message to fetch only new messages and avoid re-reading the full history."
      )
    },
    async (input) => {
      const result = await handleGetMessages(getSessionId(), input);
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    }
  );
}

// src/tools/register-review.ts
import { z as z6 } from "zod";

// src/tools/review.ts
function handleRequestReview(sessionId, input) {
  try {
    if (!getArtifactById(input.artifact_id, sessionId)) {
      return { success: false, error: "artifact not found" };
    }
    const id = crypto.randomUUID();
    insertReview({
      id,
      session_id: sessionId,
      artifact_id: input.artifact_id,
      reviewer: input.reviewer,
      requester: input.agent_id,
      status: "pending",
      comments: null
    });
    return { success: true, review_id: id };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}
function handleSubmitReview(sessionId, input) {
  try {
    const review = getReviewById(input.review_id, sessionId);
    if (!review) return { success: false, error: "review not found" };
    if (review.reviewer !== input.agent_id)
      return { success: false, error: "permission denied: not the assigned reviewer" };
    if (review.status !== "pending")
      return {
        success: false,
        error: `Review already submitted \u2014 status is ${review.status}`
      };
    updateReviewStatus(input.review_id, sessionId, input.status, input.comments ?? null);
    const updated = getReviewById(input.review_id, sessionId);
    if (!updated) {
      return { success: false, error: "Review updated but could not be re-fetched" };
    }
    return {
      success: true,
      review: {
        id: updated.id,
        status: updated.status,
        reviewer: updated.reviewer,
        comments: updated.comments
      }
    };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// src/tools/register-review.ts
function registerReviewTools(server2) {
  server2.tool(
    "request_review",
    {
      agent_id: AGENT_ID_SCHEMA.describe("ID of the agent requesting the review (the author)."),
      artifact_id: z6.string().max(128).describe(
        "ID of the artifact to be reviewed. Obtain from post_artifact response (artifact_id field)."
      ),
      reviewer: z6.string().regex(/^[a-zA-Z0-9_-]+$/).max(64).describe(
        "ID of the agent who should perform the review (e.g. qa, be2). They will call submit_review with the returned review_id."
      )
    },
    async (input) => {
      const result = await handleRequestReview(getSessionId(), input);
      if (result.success && result.review_id) {
        broadcast({
          type: "review:requested",
          review: {
            id: result.review_id,
            artifact_id: input.artifact_id,
            reviewer: input.reviewer,
            requester: input.agent_id
          },
          timestamp: Date.now()
        });
      }
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    }
  );
  server2.tool(
    "submit_review",
    {
      agent_id: AGENT_ID_SCHEMA.describe(
        "ID of the reviewing agent. Must match the reviewer field set in request_review, otherwise returns permission denied."
      ),
      review_id: z6.string().max(128).describe("Review ID returned by request_review."),
      status: z6.enum(["approved", "changes_requested"]).describe(
        "Review outcome. 'approved' signals the work is accepted. 'changes_requested' means the author must revise."
      ),
      comments: z6.string().max(16384).optional().describe("Detailed review feedback. Required when status is 'changes_requested'.")
    },
    async (input) => {
      const result = await handleSubmitReview(getSessionId(), input);
      if (result.success && result.review) {
        broadcast({ type: "review:updated", review: result.review, timestamp: Date.now() });
      }
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    }
  );
}

// src/tools/register-sessions.ts
import { z as z7 } from "zod";
function registerSessionTools(server2) {
  server2.tool(
    "start_session",
    {
      agent_id: AGENT_ID_SCHEMA.describe("ID of the calling agent (for tracking)"),
      session_id: z7.string().regex(/^[a-zA-Z0-9_-]+$/).max(128).describe("Session ID to activate (e.g. 2026-03-14-007)")
    },
    async (input) => {
      setSessionId(input.session_id);
      broadcast({ type: "session:started", sessionId: input.session_id, timestamp: Date.now() });
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ success: true, session_id: input.session_id })
          }
        ]
      };
    }
  );
  server2.tool(
    "save_session_summary",
    {
      agent_id: AGENT_ID_SCHEMA.describe("ID of the calling agent (typically the orchestrator)"),
      session_id: z7.string().regex(/^[a-zA-Z0-9_-]+$/).max(128).describe("Session ID (YYYY-MM-DD-NNN-XXXX format)"),
      summary: z7.string().max(131072).describe("Session summary text")
    },
    async (input) => {
      const result = await handleSaveSessionSummary(getRelayDir(), input);
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    }
  );
  server2.tool(
    "list_sessions",
    {
      agent_id: AGENT_ID_SCHEMA.describe("ID of the calling agent")
    },
    async (_input) => {
      const result = await handleListSessions(getRelayDir());
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    }
  );
  server2.tool(
    "get_session_summary",
    {
      agent_id: AGENT_ID_SCHEMA.describe("ID of the calling agent"),
      session_id: z7.string().regex(/^[a-zA-Z0-9_-]+$/).max(128).describe("ID of the session to retrieve")
    },
    async (input) => {
      const result = await handleGetSessionSummary(getRelayDir(), {
        session_id: input.session_id
      });
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    }
  );
  server2.tool(
    "save_orchestrator_state",
    {
      agent_id: AGENT_ID_SCHEMA.describe("ID of the calling agent (typically the orchestrator)"),
      state: z7.string().max(65536).describe(
        "JSON-stringified event loop state. The server stores this opaque string and returns it via get_orchestrator_state. The orchestrator defines its own schema \u2014 see SKILL.md for the recommended shape."
      )
    },
    async (input) => {
      const result = handleSaveOrchestratorState(getSessionId(), input);
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    }
  );
  server2.tool(
    "get_orchestrator_state",
    {
      agent_id: AGENT_ID_SCHEMA.describe("ID of the calling agent (typically the orchestrator)")
    },
    async (input) => {
      const result = handleGetOrchestratorState(getSessionId(), input);
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    }
  );
}

// src/tools/register-tasks.ts
import { z as z8 } from "zod";

// src/tools/hook-runner.ts
import { exec } from "node:child_process";
var MAX_OUTPUT_CHARS = 2e3;
var DEFAULT_BEFORE_TIMEOUT_MS = 3e4;
var DEFAULT_AFTER_TIMEOUT_MS = 12e4;
function runHook(command, env, cwd, timeoutMs) {
  return new Promise((resolve2) => {
    let settled = false;
    const settle = (result) => {
      if (!settled) {
        settled = true;
        resolve2(result);
      }
    };
    let child;
    try {
      child = exec(
        command,
        { cwd, env: { ...process.env, ...env }, maxBuffer: 10 * 1024 * 1024 },
        (error, stdout, stderr) => {
          clearTimeout(timer);
          const combined = `${stdout}${stderr}`.trim();
          const output = combined.length > MAX_OUTPUT_CHARS ? `${combined.slice(0, MAX_OUTPUT_CHARS)}
...[truncated]` : combined;
          settle({
            success: !error,
            exitCode: error ? (() => {
              const code = error.code;
              return typeof code === "number" ? code : null;
            })() : 0,
            output
          });
        }
      );
    } catch (err) {
      settle({ success: false, exitCode: null, output: `Failed to spawn hook: ${String(err)}` });
      return;
    }
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      setTimeout(() => {
        try {
          if (child.exitCode === null) child.kill("SIGKILL");
        } catch {
        }
      }, 5e3);
      settle({
        success: false,
        exitCode: null,
        output: `Hook timed out after ${timeoutMs}ms (command: ${command})`
      });
    }, timeoutMs);
  });
}
async function runHooks(commands, env, cwd, timeoutMs) {
  for (const command of commands) {
    const result = await runHook(command, env, cwd, timeoutMs);
    if (!result.success) return result;
  }
  return { success: true, exitCode: 0, output: "" };
}

// src/tools/tasks.ts
function buildHookEnv(agentId, taskId, sessionId) {
  return {
    RELAY_AGENT_ID: agentId,
    RELAY_TASK_ID: taskId,
    RELAY_SESSION_ID: sessionId
  };
}
function handleCreateTask(sessionId, input) {
  try {
    if (input.idempotency_key) {
      const existing = getTaskByExternalId(sessionId, input.idempotency_key);
      if (existing) return { success: true, task_id: existing.id };
    }
    if (input.depends_on && input.depends_on.length > 0) {
      const missing = input.depends_on.filter((depId) => !getTaskById(depId, sessionId));
      if (missing.length > 0) {
        return {
          success: false,
          error: `depends_on contains unknown task IDs: ${missing.join(", ")}`
        };
      }
    }
    let taskDepth = 0;
    if (input.parent_task_id) {
      const parent = getTaskById(input.parent_task_id, sessionId);
      if (!parent) {
        return { success: false, error: "parent task not found" };
      }
      taskDepth = (parent.depth ?? 0) + 1;
      if (taskDepth > MAX_TASK_DEPTH) {
        return { success: false, error: `max derived task depth exceeded (${MAX_TASK_DEPTH})` };
      }
      const siblingCount = countDerivedSiblings(sessionId, input.parent_task_id);
      if (siblingCount >= MAX_DERIVED_SIBLINGS) {
        return { success: false, error: `max derived siblings exceeded (${MAX_DERIVED_SIBLINGS})` };
      }
    }
    const id = crypto.randomUUID();
    insertTask({
      id,
      session_id: sessionId,
      title: input.title,
      description: input.description ?? null,
      assignee: input.assignee ?? null,
      status: "todo",
      priority: input.priority,
      created_by: input.agent_id,
      depends_on: input.depends_on ?? [],
      external_id: input.idempotency_key ?? null,
      parent_task_id: input.parent_task_id ?? null,
      depth: taskDepth,
      derived_reason: input.derived_reason ?? null
    });
    return { success: true, task_id: id };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}
async function handleUpdateTask(sessionId, input, hooks, projectRoot) {
  try {
    const updates = {};
    if (input.status !== void 0) updates.status = input.status;
    if (input.assignee !== void 0) updates.assignee = input.assignee;
    if (Object.keys(updates).length === 0) {
      return { success: false, error: "No valid fields to update" };
    }
    const existing = getTaskById(input.task_id, sessionId);
    if (!existing) return { success: false, error: "task not found" };
    if (existing.assignee !== null && existing.assignee !== input.agent_id && existing.created_by !== input.agent_id) {
      return { success: false, error: "permission denied: not the task assignee or creator" };
    }
    const updated = updateTask(input.task_id, sessionId, updates);
    if (!updated) return { success: false, error: "task not found" };
    if (input.status === "done" && hooks?.after_task?.length) {
      const hookEnv = buildHookEnv(input.agent_id, input.task_id, sessionId);
      const hookResult = await runHooks(
        hooks.after_task,
        hookEnv,
        projectRoot ?? process.cwd(),
        DEFAULT_AFTER_TIMEOUT_MS
      );
      if (!hookResult.success) {
        updateTask(input.task_id, sessionId, { status: "in_review" });
        return {
          success: false,
          // hook_failed: true distinguishes this from "task not found" (success: false without hook_failed).
          // Agents should treat hook_failed as "fix the issue and retry update_task(done)"
          // vs. task-not-found as a permanent error requiring a different recovery strategy.
          hook_failed: true,
          error: `after_task hook failed (exit ${hookResult.exitCode ?? "timeout"}): ${hookResult.output}`
        };
      }
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}
async function handleClaimTask(sessionId, input, hooks, projectRoot) {
  try {
    const task = getTaskById(input.task_id, sessionId);
    if (task && (task.depends_on ?? []).length > 0) {
      const unmetIds = [];
      for (const depId of task.depends_on ?? []) {
        const dep = getTaskById(depId, sessionId);
        if (!dep || dep.status !== "done") {
          unmetIds.push(depId);
        }
      }
      if (unmetIds.length > 0) {
        return {
          success: true,
          claimed: false,
          reason: `Unmet dependencies: ${unmetIds.join(", ")}`
        };
      }
    }
    if (hooks?.before_task?.length) {
      const hookEnv = buildHookEnv(input.agent_id, input.task_id, sessionId);
      const hookResult = await runHooks(
        hooks.before_task,
        hookEnv,
        projectRoot ?? process.cwd(),
        DEFAULT_BEFORE_TIMEOUT_MS
      );
      if (!hookResult.success) {
        return {
          success: true,
          claimed: false,
          reason: `before_task hook failed (exit ${hookResult.exitCode ?? "timeout"}): ${hookResult.output}`
        };
      }
    }
    if (task && (task.depends_on ?? []).length > 0) {
      const unmetIds = [];
      for (const depId of task.depends_on ?? []) {
        const dep = getTaskById(depId, sessionId);
        if (!dep || dep.status !== "done") {
          unmetIds.push(depId);
        }
      }
      if (unmetIds.length > 0) {
        return {
          success: true,
          claimed: false,
          reason: `Unmet dependencies (re-check after hook): ${unmetIds.join(", ")}`
        };
      }
    }
    const claimed = claimTask(input.task_id, input.agent_id, sessionId);
    if (!claimed) {
      return {
        success: true,
        claimed: false,
        reason: "Task is not in 'todo' state or is assigned to another agent"
      };
    }
    return { success: true, claimed: true };
  } catch (err) {
    return { success: false, claimed: false, error: String(err) };
  }
}
function handleGetAllTasks(sessionId, input) {
  try {
    const tasks2 = getAllTasks(sessionId, input.status, input.assignee);
    const result = input.include_description ? tasks2 : tasks2.map(({ description: _d, ...t }) => t);
    return { success: true, tasks: result };
  } catch (err) {
    return { success: false, tasks: [], error: String(err) };
  }
}

// src/tools/register-tasks.ts
function registerTaskTools(server2) {
  server2.tool(
    "create_task",
    {
      agent_id: AGENT_ID_SCHEMA.describe("ID of the agent creating the task."),
      title: z8.string().max(256).describe("Short task title shown in the Kanban column header."),
      description: z8.string().max(8192).optional().describe(
        "Detailed task description including acceptance criteria and implementation notes. Supports Markdown."
      ),
      assignee: z8.string().regex(/^[a-zA-Z0-9_-]+$/).max(64).optional().describe(
        "ID of the agent to assign. If omitted, the task is unassigned and any agent can claim it."
      ),
      priority: z8.enum(["critical", "high", "medium", "low"]).describe("Task priority. critical=blocking, high=this sprint, medium=next, low=backlog."),
      depends_on: z8.array(
        z8.string().regex(
          /^[a-zA-Z0-9_-]+$/,
          "depends_on: each task ID must be alphanumeric, hyphen, or underscore"
        ).max(128, "depends_on: each task ID must be \u2264 128 characters")
      ).max(32, "depends_on: max 32 dependencies per task").optional().describe(
        "Optional list of task IDs that must reach 'done' before this task can be started. Enables dependency chains."
      ),
      idempotency_key: z8.string().max(256).optional().describe(
        "Optional idempotency key. If a task with this key already exists in the session, returns the existing task_id without creating a duplicate. Use to make create_task safe to call again after agent re-spawn."
      ),
      parent_task_id: z8.string().regex(/^[a-zA-Z0-9_-]+$/).max(128).optional().describe(
        "Parent task ID for derived tasks. Max depth 1 (no grandchild tasks). Max 3 siblings per parent."
      ),
      derived_reason: z8.string().max(512).optional().describe("Why this task was derived from its parent task.")
    },
    async (input) => {
      const result = handleCreateTask(getSessionId(), input);
      if (result.success && result.task_id) {
        const task = getTaskById(result.task_id, getSessionId());
        if (task) {
          broadcast({ type: "task:updated", task: taskToPayload(task), timestamp: Date.now() });
        }
      }
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    }
  );
  server2.tool(
    "update_task",
    "Update a task's status or assignee. When setting status to 'done', the agent's after_task hook (if configured) runs; a non-zero exit reverts status to 'in_review' and returns { success: false, hook_failed: true, error } \u2014 fix the issue and retry. A { success: false } without hook_failed means the task was not found.",
    {
      agent_id: AGENT_ID_SCHEMA.describe("ID of the agent performing the update."),
      task_id: z8.string().max(128).describe("ID of the task to update. Must belong to the current session."),
      status: z8.enum(["todo", "in_progress", "in_review", "done"]).optional().describe(
        "New task status. Use 'in_review' before requesting a review, 'done' after work is accepted."
      ),
      assignee: z8.string().regex(/^[a-zA-Z0-9_-]+$/).max(64).optional().describe("New assignee agent ID. Use to reassign a task to another agent.")
    },
    async (input) => {
      const agentHooks = getAgents(getSessionId())?.[input.agent_id]?.hooks;
      const result = await handleUpdateTask(getSessionId(), input, agentHooks, getProjectRoot());
      if (result.success || result.hook_failed) {
        const task = getTaskById(input.task_id, getSessionId());
        if (task) {
          broadcast({ type: "task:updated", task: taskToPayload(task), timestamp: Date.now() });
        }
      }
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    }
  );
  server2.tool(
    "claim_task",
    "Atomically claim a task \u2014 transitions it to 'in_progress' only if currently 'todo'. Safe to call concurrently. If the agent has a before_task hook configured, it runs before the claim; a non-zero exit blocks claiming (claimed: false) without creating phantom in_progress state. Returns { success: true, claimed: true } on success or { success: true, claimed: false, reason } if blocked (already taken, unmet deps, or hook failed).",
    {
      agent_id: AGENT_ID_SCHEMA.describe(
        "ID of the agent claiming the task. The task must be assigned to this agent or unassigned."
      ),
      task_id: z8.string().max(128).describe(
        "ID of the task to claim. The task must be in 'todo' status. Obtain IDs from get_all_tasks."
      )
    },
    async (input) => {
      const agentHooks = getAgents(getSessionId())?.[input.agent_id]?.hooks;
      const result = await handleClaimTask(getSessionId(), input, agentHooks, getProjectRoot());
      if (result.success && result.claimed) {
        const task = getTaskById(input.task_id, getSessionId());
        if (task) {
          broadcast({ type: "task:updated", task: taskToPayload(task), timestamp: Date.now() });
        }
      }
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    }
  );
  server2.tool(
    "get_all_tasks",
    {
      agent_id: AGENT_ID_SCHEMA.describe("ID of the calling agent."),
      status: z8.enum(["todo", "in_progress", "in_review", "done"]).optional().describe(
        "Optional status filter. When provided, only tasks with this status are returned. Omit to return all tasks."
      ),
      assignee: z8.string().regex(/^[a-zA-Z0-9_-]+$/).max(64).optional().describe(
        "Optional assignee filter. When provided, only tasks assigned to this agent are returned."
      ),
      include_description: z8.boolean().optional().describe(
        "Whether to include full task descriptions in the response. Defaults to false to reduce token consumption. Set to true only when you need descriptions (e.g. when selecting a task to claim)."
      )
    },
    async (input) => {
      const result = handleGetAllTasks(getSessionId(), input);
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    }
  );
}

// src/mcp.ts
var _require = createRequire(import.meta.url);
var { version: SERVER_VERSION } = _require("../package.json");
function createMcpServer() {
  const server2 = new McpServer({
    name: "relay",
    version: SERVER_VERSION
  });
  registerAgentTools(server2);
  registerMessagingTools(server2);
  registerTaskTools(server2);
  registerArtifactTools(server2);
  registerReviewTools(server2);
  registerMemoryTools(server2);
  registerSessionTools(server2);
  return server2;
}
async function startMcpServer(server2) {
  const transport = new StdioServerTransport();
  await server2.connect(transport);
  try {
    const { roots } = await server2.server.listRoots();
    if (roots.length > 0) {
      const projectRoot = uriToPath(roots[0].uri);
      if (projectRoot) {
        setProjectRoot(projectRoot);
        console.error(`[relay] project root: ${projectRoot}`);
      } else {
        console.error(
          "[relay] roots/list returned an empty URI \u2014 falling back to RELAY_PROJECT_ROOT or cwd"
        );
      }
    } else {
      console.error(
        "[relay] roots/list returned empty \u2014 falling back to RELAY_PROJECT_ROOT or cwd"
      );
    }
  } catch {
    console.error(
      "[relay] roots/list not supported by client \u2014 falling back to RELAY_PROJECT_ROOT or cwd"
    );
  }
  console.error("[relay] MCP server started (stdio)");
}

// src/index.ts
if (process.stdin.isTTY) {
  console.error(
    "[relay] relay must be started via Claude Code MCP, not directly.\n  Install the plugin inside Claude Code:\n    /plugin marketplace add custardcream98/relay\n    /plugin install relay@relay\n  Or for local dev:\n    claude mcp add relay bun -- run src/index.ts"
  );
  process.exit(1);
}
function parseArgs(argv) {
  const result = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--port" && argv[i + 1]) {
      const p = Number(argv[i + 1]);
      if (!Number.isNaN(p)) result.port = p;
      i++;
    } else if (argv[i] === "--instance" && argv[i + 1]) {
      result.instance = argv[i + 1];
      i++;
    }
  }
  return result;
}
var cliArgs = parseArgs(process.argv.slice(2));
if (cliArgs.instance && !/^[a-zA-Z0-9_-]+$/.test(cliArgs.instance)) {
  console.error("[relay] invalid --instance value; use alphanumeric, hyphen, underscore only");
  process.exit(1);
}
if (cliArgs.instance) {
  process.env.RELAY_INSTANCE = cliArgs.instance;
}
if (process.env.RELAY_INSTANCE && !/^[a-zA-Z0-9_-]+$/.test(process.env.RELAY_INSTANCE)) {
  console.error("[relay] invalid RELAY_INSTANCE value; use alphanumeric, hyphen, underscore only");
  process.exit(1);
}
var PORT_AUTO_START = 3456;
var PORT_AUTO_END = 3465;
function isPortAvailable(port) {
  return new Promise((resolve2) => {
    const server2 = createServer();
    server2.once("error", () => resolve2(false));
    server2.once("listening", () => {
      server2.close(() => resolve2(true));
    });
    server2.listen(port);
  });
}
async function findAvailablePort(start, end) {
  for (let port = start; port <= end; port++) {
    if (await isPortAvailable(port)) return port;
  }
  return null;
}
async function resolvePort() {
  if (cliArgs.port) return cliArgs.port;
  if (process.env.DASHBOARD_PORT) {
    const p = Number(process.env.DASHBOARD_PORT);
    if (!Number.isNaN(p) && p > 0 && p <= 65535) return p;
    console.error(
      `[relay] invalid DASHBOARD_PORT "${process.env.DASHBOARD_PORT}" \u2014 falling back to auto-select`
    );
  }
  const found = await findAvailablePort(PORT_AUTO_START, PORT_AUTO_END);
  if (found === null) {
    console.error(
      `[relay] no available port found in range ${PORT_AUTO_START}-${PORT_AUTO_END} \u2014 falling back to ${PORT_AUTO_START}`
    );
    return PORT_AUTO_START;
  }
  return found;
}
var initialPort = await resolvePort();
function buildSessionSnapshot(port) {
  const sessionId = getSessionId();
  let agentMeta = [];
  try {
    const agents = loadPool();
    agentMeta = Object.values(agents).map((a) => ({
      id: a.id,
      name: a.name,
      emoji: a.emoji
    }));
  } catch {
  }
  const snapshot = {
    type: "session:snapshot",
    sessionId,
    tasks: getAllTasks(sessionId).map(taskToPayload),
    messages: getAllMessages(sessionId).map(({ session_id: _s, seq: _q, ...m }) => ({
      ...m,
      metadata: m.metadata ?? null
    })),
    artifacts: getAllArtifacts(sessionId).map(
      ({ session_id: _s, content: _c, task_id: _t, created_at: _ca, ...a }) => a
    ),
    instanceId: process.env.RELAY_INSTANCE,
    port,
    agents: agentMeta,
    timestamp: Date.now()
  };
  return JSON.stringify(snapshot);
}
async function tryServe(port) {
  return new Promise((resolve2) => {
    const srv = serve({ fetch: app.fetch, port });
    srv.once("error", async (err) => {
      srv.close();
      if (err.code === "EADDRINUSE") {
        const next = await findAvailablePort(port + 1, PORT_AUTO_END);
        if (next !== null) {
          resolve2(await tryServe(next));
        } else {
          console.error(
            `[relay] no available port in ${PORT_AUTO_START}-${PORT_AUTO_END} \u2014 dashboard unavailable, MCP server will still start.`
          );
          resolve2(null);
        }
      } else {
        console.error("[relay] dashboard server error:", err);
        resolve2(null);
      }
    });
    srv.once("listening", () => {
      console.error(`[relay] dashboard: http://localhost:${port}`);
      resolve2({ server: srv, port });
    });
  });
}
var dashResult = await tryServe(initialPort);
if (dashResult) {
  const { server: dashboardServer, port: confirmedPort } = dashResult;
  setPort(confirmedPort);
  const wss = new WebSocketServer({ noServer: true, maxPayload: 1024 * 1024 });
  dashboardServer.on("upgrade", (request, socket, head) => {
    const origin = request.headers.origin;
    if (origin && !isLocalhostOrigin(origin)) {
      socket.destroy();
      return;
    }
    const url = new URL(request.url ?? "/", `http://localhost:${confirmedPort}`);
    if (url.pathname !== "/ws") {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(request, socket, head, (ws) => {
      if (!addClient(ws)) {
        ws.close(1013, "too many clients");
        return;
      }
      markClientAlive(ws);
      ws.on("pong", () => markClientAlive(ws));
      ws.on("close", () => removeClient(ws));
      try {
        ws.send(buildSessionSnapshot(confirmedPort));
      } catch (err) {
        console.error("[relay] failed to send session snapshot:", err);
      }
    });
  });
  startHeartbeat();
} else {
  setPort(null);
}
var server = createMcpServer();
await startMcpServer(server);
