// packages/server/src/store.ts
// In-memory store replacing SQLite — session data is ephemeral (lives in process memory).
// All CRUD functions are synchronous, mirroring the former SQL query interface.

// --- Types ---

import type { TaskPriority, TaskStatus } from "@custardcream/relay-shared";

export interface MessageRow {
  id: string;
  session_id: string;
  from_agent: string;
  to_agent: string | null;
  content: string;
  thread_id: string | null;
  /** Arbitrary key-value metadata (e.g. task_id refs, structured context) */
  metadata?: Record<string, string> | null;
  created_at: number;
  /** Monotonically increasing sequence number. Use as cursor for get_messages to avoid re-fetching full history. */
  seq: number;
}

export interface TaskRow {
  id: string;
  session_id: string;
  title: string;
  description: string | null;
  assignee: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  created_by: string;
  /** IDs of tasks that must be completed before this task can start */
  depends_on?: string[];
  created_at: number;
  updated_at: number;
}

export interface ArtifactRow {
  id: string;
  session_id: string;
  name: string;
  type: string;
  content: string;
  created_by: string;
  task_id: string | null;
  created_at: number;
}

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

export interface EventRow {
  id: string;
  session_id: string;
  type: string;
  agent_id: string | null;
  payload: string;
  created_at: number;
}

export interface TeamStatusRow {
  todo: number;
  in_progress: number;
  in_review: number;
  done: number;
  total: number;
}

export interface SessionRow {
  id: string;
  created_at: number;
  event_count: number;
}

// --- Per-session limits (resource exhaustion prevention) ---
// These caps bound memory growth for long-running or adversarial sessions.
export const MAX_MESSAGES_PER_SESSION = 10_000;
export const MAX_TASKS_PER_SESSION = 1_000;
export const MAX_ARTIFACTS_PER_SESSION = 500;
export const MAX_REVIEWS_PER_SESSION = 500;
// Events are written on every MCP tool call — allow a higher cap than other collections.
export const MAX_EVENTS_PER_SESSION = 100_000;

// --- Collections ---

let messages: MessageRow[] = [];
let messageSeq = 0; // Monotonically increasing sequence number for reliable since-cursor pagination
// Per-session message count cache — avoids O(n) full-scan on every insertMessage call.
// Kept in sync with the messages array: incremented on insert, reset entirely by _resetStore().
const messageCountBySession = new Map<string, number>();

let tasks: TaskRow[] = [];
// Per-session task count cache — avoids O(n) full-scan on every insertTask call.
const taskCountBySession = new Map<string, number>();

let artifacts: ArtifactRow[] = [];
// Per-session artifact count cache — avoids O(n) full-scan on every insertArtifact call.
const artifactCountBySession = new Map<string, number>();

let reviews: ReviewRow[] = [];
// Per-session review count cache — avoids O(n) full-scan on every insertReview call.
const reviewCountBySession = new Map<string, number>();

let events: EventRow[] = [];
// Per-session event count cache — avoids O(n) full-scan on every insertEvent call.
const eventCountBySession = new Map<string, number>();

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

// --- Messages ---

/** Inserts a message and returns { seq, created_at } so callers can echo the exact stored timestamp. */
export function insertMessage(msg: Omit<MessageRow, "created_at" | "seq">): {
  seq: number;
  created_at: number;
} {
  // Use the cached counter to avoid an O(n) full-scan on every insert.
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

export function getMessagesForAgent(
  sessionId: string,
  agentId: string,
  afterSeq?: number
): MessageRow[] {
  return messages.filter(
    (m) =>
      m.session_id === sessionId &&
      (m.to_agent === agentId || m.to_agent === null) &&
      (afterSeq === undefined || m.seq > afterSeq)
  );
}

export function getAllMessages(sessionId: string): MessageRow[] {
  return messages.filter((m) => m.session_id === sessionId);
}

// --- Tasks ---

export function insertTask(task: Omit<TaskRow, "created_at" | "updated_at">): void {
  // Use the cached counter to avoid an O(n) full-scan on every insert.
  const sessionCount = taskCountBySession.get(task.session_id) ?? 0;
  if (sessionCount >= MAX_TASKS_PER_SESSION) {
    throw new Error(`session task limit reached (max ${MAX_TASKS_PER_SESSION} per session)`);
  }
  const ts = nowSeconds();
  tasks.push({ ...task, depends_on: task.depends_on ?? [], created_at: ts, updated_at: ts });
  taskCountBySession.set(task.session_id, sessionCount + 1);
}

export function updateTask(
  id: string,
  sessionId: string,
  updates: Partial<Pick<TaskRow, "status" | "assignee" | "description">>
): boolean {
  if (Object.keys(updates).length === 0) return false;
  const task = tasks.find((t) => t.id === id && t.session_id === sessionId);
  if (!task) return false;
  if ("status" in updates && updates.status !== undefined) task.status = updates.status;
  if ("assignee" in updates) task.assignee = updates.assignee ?? null;
  if ("description" in updates) task.description = updates.description ?? null;
  task.updated_at = nowSeconds();
  return true;
}

export function getTaskById(id: string, sessionId: string): TaskRow | null {
  return tasks.find((t) => t.id === id && t.session_id === sessionId) ?? null;
}

export function getTasksByAssignee(sessionId: string, assignee: string): TaskRow[] {
  return tasks.filter((t) => t.session_id === sessionId && t.assignee === assignee);
}

export function getAllTasks(sessionId: string, status?: string): TaskRow[] {
  return tasks.filter(
    (t) => t.session_id === sessionId && (status === undefined || t.status === status)
  );
}

export function claimTask(taskId: string, agentId: string, sessionId: string): boolean {
  const task = tasks.find(
    (t) =>
      t.id === taskId &&
      t.session_id === sessionId &&
      t.status === "todo" &&
      (t.assignee === agentId || t.assignee === null)
  );
  if (!task) return false;
  task.status = "in_progress";
  task.updated_at = nowSeconds();
  return true;
}

export function getTeamStatus(sessionId: string): TeamStatusRow {
  const counts = { todo: 0, in_progress: 0, in_review: 0, done: 0, total: 0 };
  for (const t of tasks) {
    if (t.session_id !== sessionId) continue;
    counts.total++;
    if (t.status === "todo") counts.todo++;
    else if (t.status === "in_progress") counts.in_progress++;
    else if (t.status === "in_review") counts.in_review++;
    else if (t.status === "done") counts.done++;
  }
  return counts;
}

// --- Artifacts ---

export function insertArtifact(artifact: Omit<ArtifactRow, "created_at">): void {
  const sessionCount = artifactCountBySession.get(artifact.session_id) ?? 0;
  if (sessionCount >= MAX_ARTIFACTS_PER_SESSION) {
    throw new Error(
      `session artifact limit reached (max ${MAX_ARTIFACTS_PER_SESSION} per session)`
    );
  }
  artifacts.push({ ...artifact, created_at: nowSeconds() });
  artifactCountBySession.set(artifact.session_id, sessionCount + 1);
}

export function getArtifactById(id: string, sessionId: string): ArtifactRow | null {
  return artifacts.find((a) => a.id === id && a.session_id === sessionId) ?? null;
}

export function getArtifactByName(sessionId: string, name: string): ArtifactRow | null {
  // Collect matching entries together with their insertion index for stable tie-breaking.
  // created_at is second-precision, so two artifacts posted within the same second would have
  // equal sort keys — insertion index (position in the array) breaks the tie so the most
  // recently inserted artifact always wins.
  const matches = artifacts
    .map((a, idx) => ({ a, idx }))
    .filter(({ a }) => a.session_id === sessionId && a.name === name)
    .sort((x, y) => y.a.created_at - x.a.created_at || y.idx - x.idx);
  return matches[0]?.a ?? null;
}

export function getAllArtifacts(sessionId: string): ArtifactRow[] {
  return artifacts.filter((a) => a.session_id === sessionId);
}

// --- Reviews ---

export function insertReview(review: Omit<ReviewRow, "created_at" | "updated_at">): void {
  const sessionCount = reviewCountBySession.get(review.session_id) ?? 0;
  if (sessionCount >= MAX_REVIEWS_PER_SESSION) {
    throw new Error(`session review limit reached (max ${MAX_REVIEWS_PER_SESSION} per session)`);
  }
  const ts = nowSeconds();
  reviews.push({ ...review, created_at: ts, updated_at: ts });
  reviewCountBySession.set(review.session_id, sessionCount + 1);
}

export function updateReviewStatus(
  id: string,
  sessionId: string,
  status: string,
  comments: string | null
): void {
  const review = reviews.find((r) => r.id === id && r.session_id === sessionId);
  if (review) {
    review.status = status;
    review.comments = comments;
    review.updated_at = nowSeconds();
  }
}

export function getReviewById(id: string, sessionId: string): ReviewRow | null {
  return reviews.find((r) => r.id === id && r.session_id === sessionId) ?? null;
}

export function getReviewsByReviewer(sessionId: string, reviewer: string): ReviewRow[] {
  return reviews.filter((r) => r.session_id === sessionId && r.reviewer === reviewer);
}

// --- Events ---

export function insertEvent(
  sessionId: string,
  eventPayload: string,
  type: string,
  agentId: string | null,
  timestampMs: number
): void {
  const sessionCount = eventCountBySession.get(sessionId) ?? 0;
  if (sessionCount >= MAX_EVENTS_PER_SESSION) {
    // Silently drop events beyond the cap — events are best-effort telemetry.
    // Throwing here would break every MCP tool call, which is too disruptive.
    return;
  }
  events.push({
    id: crypto.randomUUID(),
    session_id: sessionId,
    type,
    agent_id: agentId,
    payload: eventPayload,
    created_at: Math.floor(timestampMs / 1000),
  });
  eventCountBySession.set(sessionId, sessionCount + 1);
}

export function getEventsBySession(sessionId: string): string[] {
  return events
    .filter((e) => e.session_id === sessionId)
    .sort((a, b) => a.created_at - b.created_at || a.id.localeCompare(b.id))
    .map((e) => e.payload);
}

// --- Sessions ---

export function getAllSessions(limit = 20): SessionRow[] {
  const sessionMap = new Map<string, { created_at: number; count: number }>();
  for (const e of events) {
    const existing = sessionMap.get(e.session_id);
    if (!existing) {
      sessionMap.set(e.session_id, { created_at: e.created_at, count: 1 });
    } else {
      if (e.created_at < existing.created_at) existing.created_at = e.created_at;
      existing.count++;
    }
  }
  return [...sessionMap.entries()]
    .map(([id, { created_at, count }]) => ({ id, created_at, event_count: count }))
    .sort((a, b) => b.created_at - a.created_at)
    .slice(0, limit);
}

// --- Reset (test isolation) ---

/** Clear all in-memory collections. Called by runMigrations() so existing test patterns work. */
export function _resetStore(): void {
  messages = [];
  messageSeq = 0;
  messageCountBySession.clear();
  tasks = [];
  taskCountBySession.clear();
  artifacts = [];
  artifactCountBySession.clear();
  reviews = [];
  reviewCountBySession.clear();
  events = [];
  eventCountBySession.clear();
}
