import { useCallback, useEffect, useMemo, useReducer, useState } from "react";
import type { AgentId, RelayEvent } from "relay-shared";
import { AppLayout } from "./components/AppLayout";
import { AgentsContext } from "./context/AgentsContext";
import { ConnectionContext } from "./context/ConnectionContext";
import { PanelResizeProvider } from "./context/PanelResizeContext";
import { ServerContext } from "./context/ServerContext";
import { SessionContext } from "./context/SessionContext";
import { useRelaySocket } from "./hooks/useRelaySocket";
import { initialState, reducer } from "./state/dashboardReducer";
import type { AgentMeta, DashboardEvent, ServerEntry } from "./types";
import { normalizeUrl } from "./utils/url";

export default function App() {
  const [state, dispatch] = useReducer(reducer, initialState);

  // Active relay server URL — must be declared before useRelaySocket so the hook gets the URL
  const [activeServer, setActiveServer] = useState<string>(
    `${window.location.protocol}//${window.location.host}`
  );

  const handleEvent = useCallback((event: RelayEvent) => {
    dispatch({ type: "EVENT", event: event as DashboardEvent });
  }, []);
  const { connected, reconnecting, maxRetriesExhausted, attempt, nextRetryIn, retryNow } =
    useRelaySocket({
      onEvent: handleEvent,
      // Pass the active server URL so the hook reconnects when the user switches servers
      serverUrl: activeServer,
    });

  const {
    tasks,
    messages,
    agentStatuses,
    thinkingChunks,
    selectedAgent,
    timeline,
    instanceId,
    instancePort,
    sessionTeam,
    liveSessionId,
    totalEventCount,
    sessionStartCount,
  } = state;

  // Fetch agent list — passed to AgentArena via AgentsContext
  const [agents, setAgents] = useState<AgentMeta[]>([]);
  const [agentsLoading, setAgentsLoading] = useState(true);
  const [agentsError, setAgentsError] = useState(false);

  // Re-fetch agent list when the active server changes or a new relay session starts.
  // sessionStartCount triggers re-fetch so a newly auto-generated pool is picked up.
  // biome-ignore lint/correctness/useExhaustiveDependencies: sessionStartCount intentionally triggers re-fetch on session:started
  useEffect(() => {
    const controller = new AbortController();
    const base = normalizeUrl(activeServer);
    fetch(`${base}/api/agents`, { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: Array<{ id: AgentId; name: string; emoji: string; basePersonaId?: string }>) => {
        setAgents(
          data.map((item) => ({
            id: item.id,
            name: item.name,
            emoji: item.emoji,
            basePersonaId: item.basePersonaId,
          }))
        );
        setAgentsLoading(false);
        setAgentsError(false);
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === "AbortError") return;
        setAgentsError(true);
        setAgentsLoading(false);
      });
    return () => controller.abort();
  }, [activeServer, sessionStartCount]);

  // Fetch server list — BE will add GET /api/servers; graceful fallback to empty array
  const [servers, setServers] = useState<ServerEntry[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    const base = normalizeUrl(activeServer);
    fetch(`${base}/api/servers`, { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<ServerEntry[]>;
      })
      .then((data) => setServers(data))
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === "AbortError") return;
        // Graceful: /api/servers not yet available — single-server mode, no switcher shown
        setServers([]);
      });
    return () => controller.abort();
  }, [activeServer]);

  // Switch active relay server: reconnects the WebSocket and clears stale state
  const handleSwitchServer = useCallback(
    (url: string) => {
      // No-op when already connected to the same server
      if (url === activeServer) return;
      setActiveServer(url);
      // Update isActive flags in the server list to reflect the new selection
      setServers((prev) => prev.map((s) => ({ ...s, isActive: s.url === url })));
      // Reset all session state — agentStatuses, thinkingChunks, tasks, messages etc.
      // are server-specific and must not bleed across server switches
      dispatch({ type: "SWITCH_SERVER" });
    },
    [activeServer]
  );

  const handleAddServer = useCallback((url: string) => {
    setServers((prev) => [...prev, { url, label: url, status: "connecting", isActive: false }]);
  }, []);

  const handleSelectAgent = useCallback((id: AgentId | null) => {
    dispatch({ type: "SELECT_AGENT", agentId: id });
  }, []);

  // Stabilize context values with useMemo so consumers only re-render when relevant state changes
  const sessionValue = useMemo(
    () => ({
      tasks,
      messages,
      agentStatuses,
      thinkingChunks,
      selectedAgent,
      timeline,
      instanceId,
      instancePort,
      sessionTeam,
      totalEventCount,
      liveSessionId,
      onSelectAgent: handleSelectAgent,
    }),
    [
      tasks,
      messages,
      agentStatuses,
      thinkingChunks,
      selectedAgent,
      timeline,
      instanceId,
      instancePort,
      sessionTeam,
      totalEventCount,
      liveSessionId,
      handleSelectAgent,
    ]
  );

  const connectionValue = useMemo(
    () => ({
      connected,
      reconnecting,
      maxRetriesExhausted,
      attempt,
      nextRetryIn,
      onRetryNow: retryNow,
    }),
    [connected, reconnecting, maxRetriesExhausted, attempt, nextRetryIn, retryNow]
  );

  const serverValue = useMemo(
    () => ({
      servers,
      activeServer,
      onSwitchServer: handleSwitchServer,
      onAddServer: handleAddServer,
    }),
    [servers, activeServer, handleSwitchServer, handleAddServer]
  );

  const agentsValue = useMemo(
    () => ({
      agents,
      agentsLoading,
      agentsError,
    }),
    [agents, agentsLoading, agentsError]
  );

  return (
    <SessionContext.Provider value={sessionValue}>
      <ConnectionContext.Provider value={connectionValue}>
        <ServerContext.Provider value={serverValue}>
          <AgentsContext.Provider value={agentsValue}>
            <PanelResizeProvider>
              <AppLayout />
            </PanelResizeProvider>
          </AgentsContext.Provider>
        </ServerContext.Provider>
      </ConnectionContext.Provider>
    </SessionContext.Provider>
  );
}
