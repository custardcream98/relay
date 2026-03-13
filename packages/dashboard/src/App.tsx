// packages/dashboard/src/App.tsx
import type { AgentId, RelayEvent } from "@custardcream/relay-shared";
import { useCallback, useReducer } from "react";
import { AgentStatusBar } from "./components/AgentStatusBar";
import { AgentThoughts } from "./components/AgentThoughts";
import { MessageFeed } from "./components/MessageFeed";
import { TaskBoard } from "./components/TaskBoard";
import { useRelaySocket } from "./hooks/useRelaySocket";
import { useResizablePanels } from "./hooks/useResizablePanels";

interface DashboardState {
  tasks: Array<{
    id: string;
    title: string;
    assignee: string | null;
    status: string;
    priority: string;
  }>;
  messages: Array<{
    id: string;
    from_agent: string;
    to_agent: string | null;
    content: string;
    created_at: number;
  }>;
  agentStatuses: Partial<Record<AgentId, "idle" | "working" | "waiting">>;
  thinkingChunks: Partial<Record<AgentId, string>>;
  selectedAgent: AgentId | null;
}

type Action =
  | { type: "EVENT"; event: RelayEvent }
  | { type: "SELECT_AGENT"; agentId: AgentId | null };

const initialState: DashboardState = {
  tasks: [],
  messages: [],
  agentStatuses: {},
  thinkingChunks: {},
  selectedAgent: null,
};

function reducer(state: DashboardState, action: Action): DashboardState {
  switch (action.type) {
    case "EVENT": {
      const event = action.event;
      switch (event.type) {
        case "session:snapshot":
          return {
            ...state,
            tasks: event.tasks as DashboardState["tasks"],
            messages: event.messages as DashboardState["messages"],
          };
        case "agent:status":
          return {
            ...state,
            agentStatuses: { ...state.agentStatuses, [event.agentId]: event.status },
            thinkingChunks:
              event.status !== "working"
                ? { ...state.thinkingChunks, [event.agentId]: "" }
                : state.thinkingChunks,
          };
        case "agent:thinking":
          return {
            ...state,
            thinkingChunks: {
              ...state.thinkingChunks,
              [event.agentId]: (state.thinkingChunks[event.agentId] ?? "") + event.chunk,
            },
          };
        case "message:new":
          return { ...state, messages: [event.message, ...state.messages] };
        case "task:updated": {
          const existing = state.tasks.findIndex((t) => t.id === event.task.id);
          const tasks =
            existing >= 0
              ? state.tasks.map((t) => (t.id === event.task.id ? event.task : t))
              : [...state.tasks, event.task];
          return { ...state, tasks };
        }
        default:
          return state;
      }
    }
    case "SELECT_AGENT":
      return { ...state, selectedAgent: action.agentId };
    default:
      return state;
  }
}

// Panel header height (px)
const PANEL_HEADER_H = 33;

export default function App() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const handleEvent = useCallback((event: RelayEvent) => {
    dispatch({ type: "EVENT", event });
  }, []);
  const { connected } = useRelaySocket({ onEvent: handleEvent });
  const { tasks, messages, agentStatuses, thinkingChunks, selectedAgent } = state;

  // Resize hook — 3 panels
  const { widths, containerRef, startDrag } = useResizablePanels(3);

  const PANELS = [
    {
      label: "Task Board",
      content: <TaskBoard tasks={tasks} />,
    },
    {
      label: "Message Feed",
      content: <MessageFeed messages={messages} />,
    },
    {
      label: selectedAgent ? `${selectedAgent} — thoughts` : "Agent Thoughts",
      content: (
        <AgentThoughts
          agentId={selectedAgent}
          chunks={selectedAgent ? (thinkingChunks[selectedAgent] ?? "") : ""}
        />
      ),
    },
  ];

  return (
    <div className="h-screen flex flex-col bg-[#09090b] text-zinc-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-10 border-b border-zinc-800 flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold tracking-tight text-zinc-100">relay</span>
          <span className="text-[10px] text-zinc-700 font-mono">dashboard</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className={`w-1.5 h-1.5 rounded-full ${connected ? "bg-emerald-500" : "bg-red-500"}`}
          />
          <span className="text-[11px] text-zinc-600">
            {connected ? "connected" : "disconnected"}
          </span>
        </div>
      </div>

      {/* Agent status bar */}
      <AgentStatusBar
        statuses={agentStatuses}
        selected={selectedAgent}
        onSelect={(id) => dispatch({ type: "SELECT_AGENT", agentId: id })}
      />

      {/* 3-panel layout — resizable */}
      <div ref={containerRef} className="flex flex-1 overflow-hidden relative">
        {PANELS.map((panel, idx) => (
          <div
            key={panel.label}
            className="flex flex-col overflow-hidden"
            style={{ width: `${widths[idx]}%` }}
          >
            {/* Panel header */}
            <div
              style={{ height: PANEL_HEADER_H }}
              className="flex items-center px-4 border-b border-r border-zinc-800 flex-shrink-0"
            >
              <span className="text-[10px] font-medium text-zinc-600 uppercase tracking-widest truncate">
                {panel.label}
              </span>
            </div>

            {/* Panel body */}
            <div
              className="overflow-hidden flex-1 border-r border-zinc-800"
              style={{ height: `calc(100% - ${PANEL_HEADER_H}px)` }}
            >
              {panel.content}
            </div>
          </div>
        ))}

        {/* Drag handles — overlay between panels */}
        {[0, 1].map((handleIdx) => (
          <div
            key={handleIdx}
            onMouseDown={(e) => startDrag(handleIdx, e)}
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              // Handle position: align to panel boundary (based on widths sum)
              left: `${widths.slice(0, handleIdx + 1).reduce((a, b) => a + b, 0)}%`,
              width: 6,
              transform: "translateX(-50%)",
              cursor: "col-resize",
              zIndex: 10,
            }}
            className="group flex items-center justify-center hover:bg-blue-500/20 transition-colors"
          >
            <div className="w-px h-full bg-transparent group-hover:bg-blue-500/50 transition-colors" />
          </div>
        ))}
      </div>
    </div>
  );
}
