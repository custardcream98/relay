// packages/dashboard/src/constants/agents.ts
// Per-agent accent colors — keep in sync with CSS custom properties

export const DEFAULT_AGENT_ACCENT = "#9898a8";

export const AGENT_ACCENT_HEX: Partial<Record<string, string>> = {
  pm: "#c084fc",
  designer: "#f472b6",
  da: "#fbbf24",
  fe: "#60a5fa",
  be: "#34d399",
  qa: "#fb923c",
  deployer: "#f97316",
};

// Palette for dynamically composed pool agents — deterministic hash mapping
const POOL_ACCENT_PALETTE = [
  "#a78bfa",
  "#f472b6",
  "#fbbf24",
  "#60a5fa",
  "#34d399",
  "#fb923c",
  "#f97316",
  "#38bdf8",
  "#4ade80",
  "#e879f9",
  "#facc15",
  "#f87171",
];

// djb2-style hash — returns a stable index into POOL_ACCENT_PALETTE for any agent id
function hashAgentId(id: string): number {
  let h = 5381;
  for (let i = 0; i < id.length; i++) {
    h = ((h << 5) + h) ^ id.charCodeAt(i);
    h = h >>> 0; // keep unsigned 32-bit
  }
  return h % POOL_ACCENT_PALETTE.length;
}

// Returns the accent color for any agent id — falls back to pool palette for unknown ids
export function getAgentAccent(id: string): string {
  return AGENT_ACCENT_HEX[id] ?? POOL_ACCENT_PALETTE[hashAgentId(id)];
}
