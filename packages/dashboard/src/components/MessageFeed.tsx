// packages/dashboard/src/components/MessageFeed.tsx
import { useEffect, useRef } from "react";
import { MarkdownContent } from "./MarkdownContent";

interface Message {
  id: string;
  from_agent: string;
  to_agent: string | null;
  content: string;
  created_at: number;
}

const AGENT_COLORS: Record<string, string> = {
  pm: "text-purple-400",
  designer: "text-pink-400",
  da: "text-yellow-400",
  fe: "text-blue-400",
  be: "text-emerald-400",
  qa: "text-orange-400",
  deployer: "text-orange-400",
};

function formatTime(unixSecs: number) {
  return new Date(unixSecs * 1000).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

export function MessageFeed({ messages }: { messages: Message[] }) {
  const bottomRef = useRef<HTMLDivElement>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll on messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <span className="text-[11px] text-zinc-700 tracking-wider uppercase">No messages</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col divide-y divide-zinc-800/60 overflow-y-auto h-full">
      {messages.map((msg) => (
        <div key={msg.id} className="px-4 py-3 hover:bg-zinc-900/40 transition-colors">
          {/* Header */}
          <div className="flex items-center gap-1.5 mb-2">
            <span
              className={`text-xs font-semibold ${AGENT_COLORS[msg.from_agent] ?? "text-zinc-300"}`}
            >
              {msg.from_agent}
            </span>
            {msg.to_agent ? (
              <>
                <span className="text-[10px] text-zinc-700">→</span>
                <span
                  className={`text-xs font-semibold ${AGENT_COLORS[msg.to_agent] ?? "text-zinc-300"}`}
                >
                  {msg.to_agent}
                </span>
              </>
            ) : (
              <span className="text-[10px] text-zinc-700 uppercase tracking-wider">broadcast</span>
            )}
            <span className="ml-auto text-[10px] text-zinc-700 font-mono tabular-nums">
              {formatTime(msg.created_at)}
            </span>
          </div>

          {/* Body — markdown rendering */}
          <MarkdownContent text={msg.content} />
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
