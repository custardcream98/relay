// packages/server/src/utils/broadcast.ts
import type { TaskRow } from "../store.js";

// Build a task payload suitable for broadcasting task:updated WebSocket events.
// Includes created_at and updated_at for parity with session:snapshot tasks.
// Omits session_id, created_by, external_id — these are internal fields.
export function taskToPayload(task: TaskRow) {
  return {
    id: task.id,
    title: task.title,
    assignee: task.assignee,
    status: task.status,
    priority: task.priority,
    description: task.description,
    depends_on: task.depends_on,
    parent_task_id: task.parent_task_id ?? null,
    depth: task.depth ?? 0,
    derived_reason: task.derived_reason ?? null,
    created_at: task.created_at,
    updated_at: task.updated_at,
  };
}
