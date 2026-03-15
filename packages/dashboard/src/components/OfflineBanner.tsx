// packages/dashboard/src/components/OfflineBanner.tsx
// Shown only while the WebSocket connection is lost and reconnecting.

import { useConnection } from "../context/ConnectionContext";

export function OfflineBanner() {
  const { connected, reconnecting, attempt, nextRetryIn, onRetryNow } = useConnection();

  if (connected || !reconnecting) return null;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        padding: "7px 16px",
        background: "#92400e",
        color: "#fef3c7",
        fontSize: 12,
        fontWeight: 500,
        flexShrink: 0,
        borderBottom: "1px solid #b45309",
      }}
    >
      <span style={{ fontSize: 14 }}>⚠</span>
      <span>
        Connection lost — reconnecting in {nextRetryIn}s (attempt {attempt + 1}/5)
      </span>
      <button
        type="button"
        onClick={onRetryNow}
        style={{
          marginLeft: 8,
          padding: "2px 10px",
          borderRadius: 4,
          fontSize: 11,
          fontWeight: 600,
          cursor: "pointer",
          border: "1px solid #fef3c7",
          background: "transparent",
          color: "#fef3c7",
        }}
      >
        Retry now
      </button>
    </div>
  );
}
