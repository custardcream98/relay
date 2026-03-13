// packages/dashboard/src/components/TaskBoard.tsx
import { useMemo } from "react";

interface Task {
  id: string;
  title: string;
  assignee: string | null;
  status: string;
  priority: string;
}

const COLUMNS = ["todo", "in_progress", "in_review", "done"] as const;
const COLUMN_LABELS: Record<string, string> = {
  todo: "Todo",
  in_progress: "In Progress",
  in_review: "In Review",
  done: "Done",
};

const PRIORITY_DOT: Record<string, string> = {
  critical: "bg-red-500",
  high: "bg-orange-400",
  medium: "bg-yellow-500",
  low: "bg-zinc-600",
};

const AGENT_COLORS: Record<string, string> = {
  pm: "text-purple-400",
  designer: "text-pink-400",
  da: "text-yellow-400",
  fe: "text-blue-400",
  be: "text-emerald-400",
  qa: "text-orange-400",
  deployer: "text-orange-400",
};

export function TaskBoard({ tasks }: { tasks: Task[] }) {
  const tasksByStatus = useMemo(() => {
    const grouped: Record<string, Task[]> = {
      todo: [],
      in_progress: [],
      in_review: [],
      done: [],
    };
    for (const task of tasks) {
      if (!grouped[task.status]) grouped[task.status] = [];
      grouped[task.status].push(task);
    }
    return grouped;
  }, [tasks]);

  return (
    <div className="flex gap-0 h-full divide-x divide-zinc-800/60">
      {COLUMNS.map((col) => {
        const colTasks = tasksByStatus[col] ?? [];
        return (
          <div key={col} className="flex-1 min-w-0 flex flex-col overflow-hidden">
            {/* Column header */}
            <div className="px-3 py-2 flex items-center gap-2 border-b border-zinc-800/60">
              <span className="text-[10px] font-medium text-zinc-600 uppercase tracking-widest">
                {COLUMN_LABELS[col]}
              </span>
              {colTasks.length > 0 && (
                <span className="text-[10px] text-zinc-700 font-mono">{colTasks.length}</span>
              )}
            </div>

            {/* Task list */}
            <div className="flex-1 overflow-y-auto py-1.5 px-2 flex flex-col gap-1">
              {colTasks.map((task) => (
                <div
                  key={task.id}
                  className={`
                    px-2.5 py-2 rounded text-xs leading-snug
                    border border-zinc-800/80 bg-zinc-900/40
                    hover:bg-zinc-900 transition-colors
                    ${col === "done" ? "opacity-50" : ""}
                  `}
                >
                  <div className="flex items-start gap-2">
                    <span
                      className={`mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                        PRIORITY_DOT[task.priority] ?? "bg-zinc-600"
                      }`}
                    />
                    <span
                      className={`${col === "done" ? "line-through text-zinc-500" : "text-zinc-300"} leading-snug`}
                    >
                      {task.title}
                    </span>
                  </div>
                  {task.assignee && (
                    <div
                      className={`mt-1 text-[10px] font-mono ${AGENT_COLORS[task.assignee] ?? "text-zinc-600"}`}
                    >
                      {task.assignee}
                    </div>
                  )}
                </div>
              ))}
              {colTasks.length === 0 && (
                <div className="flex items-center justify-center h-12">
                  <span className="text-[10px] text-zinc-800">—</span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
