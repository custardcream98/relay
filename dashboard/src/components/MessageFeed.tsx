// dashboard/src/components/MessageFeed.tsx
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
  be: "text-green-400",
  qa: "text-orange-400",
};

export function MessageFeed({ messages }: { messages: Message[] }) {
  return (
    <div className="flex flex-col gap-3 p-3 overflow-y-auto h-full">
      {messages.map((msg) => (
        <div key={msg.id} className="bg-gray-800 rounded-lg p-3 text-sm">
          <div className="flex items-center gap-2 mb-1">
            <span
              className={`font-semibold ${AGENT_COLORS[msg.from_agent] ?? "text-gray-300"}`}
            >
              {msg.from_agent}
            </span>
            {msg.to_agent && (
              <>
                <span className="text-gray-600">→</span>
                <span
                  className={`font-semibold ${AGENT_COLORS[msg.to_agent] ?? "text-gray-300"}`}
                >
                  {msg.to_agent}
                </span>
              </>
            )}
            {!msg.to_agent && (
              <span className="text-xs text-gray-600">(전체)</span>
            )}
          </div>
          <p className="text-gray-300 leading-relaxed">{msg.content}</p>
        </div>
      ))}
      {messages.length === 0 && (
        <p className="text-gray-600 text-sm text-center mt-8">
          아직 메시지가 없습니다
        </p>
      )}
    </div>
  );
}
