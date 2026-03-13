// dashboard/src/components/TaskBoard.tsx
interface Task {
  id: string;
  title: string;
  assignee: string | null;
  status: string;
  priority: string;
}

const COLUMNS = ["todo", "in_progress", "in_review", "done"] as const;
const COLUMN_LABELS = {
  todo: "Todo",
  in_progress: "In Progress",
  in_review: "In Review",
  done: "Done",
};
const PRIORITY_COLOR = {
  critical: "bg-red-500",
  high: "bg-orange-400",
  medium: "bg-yellow-400",
  low: "bg-gray-400",
};

export function TaskBoard({ tasks }: { tasks: Task[] }) {
  return (
    <div className="flex gap-3 p-3 h-full overflow-x-auto">
      {COLUMNS.map((col) => (
        <div key={col} className="flex-1 min-w-40">
          <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">
            {COLUMN_LABELS[col]} ({tasks.filter((t) => t.status === col).length}
            )
          </h3>
          <div className="flex flex-col gap-2">
            {tasks
              .filter((t) => t.status === col)
              .map((task) => (
                <div key={task.id} className="bg-gray-800 rounded-lg p-2.5 text-sm">
                  <div className="flex items-start gap-2">
                    <span
                      className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${PRIORITY_COLOR[task.priority as keyof typeof PRIORITY_COLOR] ?? "bg-gray-400"}`}
                    />
                    <span className="text-gray-200 leading-snug">{task.title}</span>
                  </div>
                  {task.assignee && (
                    <div className="mt-1.5 text-xs text-gray-500">
                      → {task.assignee}
                    </div>
                  )}
                </div>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}
