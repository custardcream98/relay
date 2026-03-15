// packages/server/src/store.ts
// In-memory store replacing SQLite — session data is ephemeral (lives in process memory).
// All CRUD functions are synchronous, mirroring the former SQL query interface.

// --- Types ---

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
}

export interface TaskRow {
  id: string;
  session_id: string;
  title: string;
  description: string | null;
  assignee: string | null;
  status: string;
  priority: string;
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

// --- Collections ---

let messages: MessageRow[] = [];
let tasks: TaskRow[] = [];
let artifacts: ArtifactRow[] = [];
let reviews: ReviewRow[] = [];
let events: EventRow[] = [];

function now(): number {
  return Math.floor(Date.now() / 1000);
}

// --- Messages ---

export function insertMessage(msg: Omit<MessageRow, "created_at">): void {
  messages.push({ ...msg, metadata: msg.metadata ?? null, created_at: now() });
}

export function getMessagesForAgent(sessionId: string, agentId: string): MessageRow[] {
  return messages.filter(
    (m) => m.session_id === sessionId && (m.to_agent === agentId || m.to_agent === null)
  );
}

export function getAllMessages(sessionId: string): MessageRow[] {
  return messages.filter((m) => m.session_id === sessionId);
}

// --- Tasks ---

const ALLOWED_UPDATE_KEYS = new Set<string>(["status", "assignee", "description"]);

export function insertTask(task: Omit<TaskRow, "created_at" | "updated_at">): void {
  const ts = now();
  tasks.push({ ...task, depends_on: task.depends_on ?? [], created_at: ts, updated_at: ts });
}

export function updateTask(
  id: string,
  sessionId: string,
  updates: Partial<Pick<TaskRow, "status" | "assignee" | "description">>
): boolean {
  const keys = Object.keys(updates).filter((k) => ALLOWED_UPDATE_KEYS.has(k));
  if (keys.length === 0) return false;
  const task = tasks.find((t) => t.id === id && t.session_id === sessionId);
  if (!task) return false;
  for (const k of keys) {
    (task as unknown as Record<string, unknown>)[k] =
      (updates as Record<string, unknown>)[k] ?? null;
  }
  task.updated_at = now();
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
  task.updated_at = now();
  return true;
}

export function getTeamStatus(sessionId: string): TeamStatusRow {
  const sessionTasks = tasks.filter((t) => t.session_id === sessionId);
  return {
    todo: sessionTasks.filter((t) => t.status === "todo").length,
    in_progress: sessionTasks.filter((t) => t.status === "in_progress").length,
    in_review: sessionTasks.filter((t) => t.status === "in_review").length,
    done: sessionTasks.filter((t) => t.status === "done").length,
    total: sessionTasks.length,
  };
}

// --- Artifacts ---

export function insertArtifact(artifact: Omit<ArtifactRow, "created_at">): void {
  artifacts.push({ ...artifact, created_at: now() });
}

export function getArtifactByName(sessionId: string, name: string): ArtifactRow | null {
  const matches = artifacts
    .filter((a) => a.session_id === sessionId && a.name === name)
    .sort((a, b) => b.created_at - a.created_at);
  return matches[0] ?? null;
}

export function getAllArtifacts(sessionId: string): ArtifactRow[] {
  return artifacts.filter((a) => a.session_id === sessionId);
}

// --- Reviews ---

export function insertReview(review: Omit<ReviewRow, "created_at" | "updated_at">): void {
  const ts = now();
  reviews.push({ ...review, created_at: ts, updated_at: ts });
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
    review.updated_at = now();
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
  events.push({
    id: crypto.randomUUID(),
    session_id: sessionId,
    type,
    agent_id: agentId,
    payload: eventPayload,
    created_at: Math.floor(timestampMs / 1000),
  });
}

export function getEventsBySession(sessionId: string): string[] {
  return events
    .filter((e) => e.session_id === sessionId)
    .sort((a, b) => a.created_at - b.created_at || 0)
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
  tasks = [];
  artifacts = [];
  reviews = [];
  events = [];
}
