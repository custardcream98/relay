// packages/server/src/utils/broadcast.ts
import type { TaskRow } from "../store.js";

// Build a task payload suitable for broadcasting task:updated WebSocket events.
// Omits session_id, created_by, created_at, updated_at — these are internal fields.
export function taskToPayload(task: TaskRow) {
  return {
    id: task.id,
    title: task.title,
    assignee: task.assignee,
    status: task.status,
    priority: task.priority,
    description: task.description,
    depends_on: task.depends_on,
  };
}
