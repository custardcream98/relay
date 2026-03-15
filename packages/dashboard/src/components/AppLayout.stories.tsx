import type { AgentId } from "@custardcream/relay-shared";
import type { Meta, StoryObj } from "@storybook/react";
import type { ReactNode } from "react";
import { AgentsContext } from "../context/AgentsContext";
import { ConnectionContext } from "../context/ConnectionContext";
import { PanelResizeProvider } from "../context/PanelResizeContext";
import { ServerContext } from "../context/ServerContext";
import { SessionContext } from "../context/SessionContext";
import type { AgentMeta, Message, ServerEntry, Task, TimelineEntry } from "../types";
import { AppLayout } from "./AppLayout";

const now = Date.now();
const ago = (s: number) => now - s * 1000;

const AGENTS: AgentMeta[] = [
  { id: "pm" as AgentId, name: "Product Manager", emoji: "📋" },
  { id: "fe" as AgentId, name: "Frontend Engineer", emoji: "🎨" },
  { id: "be" as AgentId, name: "Backend Engineer", emoji: "⚙️" },
  { id: "qa" as AgentId, name: "QA Engineer", emoji: "🔍" },
];

const TASKS: Task[] = [
  {
    id: "1",
    title: "Design login page",
    assignee: "fe",
    status: "done",
    priority: "high",
    description: "Figma spec with responsive layout",
  },
  {
    id: "2",
    title: "Implement auth API",
    assignee: "be",
    status: "in_progress",
    priority: "critical",
    description: "JWT-based auth with refresh tokens",
  },
  {
    id: "3",
    title: "Frontend login form",
    assignee: "fe",
    status: "in_progress",
    priority: "high",
  },
  {
    id: "4",
    title: "Review auth implementation",
    assignee: "qa",
    status: "todo",
    priority: "medium",
  },
];

const MESSAGES: Message[] = [
  {
    id: "1",
    from_agent: "pm",
    to_agent: null,
    content: "Session started. Analyzing requirements and creating tasks.",
    created_at: Math.floor(ago(400) / 1000),
  },
  {
    id: "2",
    from_agent: "be",
    to_agent: "pm",
    content: "Should the refresh token be stored in an httpOnly cookie or localStorage?",
    created_at: Math.floor(ago(300) / 1000),
  },
  {
    id: "3",
    from_agent: "pm",
    to_agent: "be",
    content: "Use httpOnly cookie for security. SameSite=Strict.",
    created_at: Math.floor(ago(290) / 1000),
  },
];

const TIMELINE: TimelineEntry[] = [
  {
    id: "1",
    type: "message:new",
    agentId: "pm",
    description: "Broadcast message",
    detail: "Session started. Analyzing requirements and creating tasks.",
    timestamp: ago(400),
  },
  {
    id: "2",
    type: "task:updated",
    agentId: "pm",
    description: "Task todo: Design login page",
    timestamp: ago(390),
  },
  {
    id: "3",
    type: "task:updated",
    agentId: "pm",
    description: "Task todo: Implement auth API",
    timestamp: ago(388),
  },
  {
    id: "4",
    type: "message:new",
    agentId: "fe",
    description: "Broadcast message",
    detail: "Claiming the design task. Starting now.",
    timestamp: ago(380),
  },
  {
    id: "5",
    type: "task:updated",
    agentId: "fe",
    description: "Task in progress: Design login page",
    timestamp: ago(378),
  },
  {
    id: "6",
    type: "message:new",
    agentId: "be",
    description: "→ pm",
    detail: "Should the refresh token be stored in an httpOnly cookie or localStorage?",
    timestamp: ago(300),
  },
  {
    id: "7",
    type: "message:new",
    agentId: "pm",
    description: "→ be",
    detail: "Use httpOnly cookie for security. SameSite=Strict.",
    timestamp: ago(290),
  },
  {
    id: "8",
    type: "artifact:posted",
    agentId: "fe",
    description: "Artifact: login-design-spec",
    timestamp: ago(200),
  },
  {
    id: "9",
    type: "review:requested",
    agentId: "fe",
    description: "Review requested from pm",
    timestamp: ago(195),
  },
  {
    id: "10",
    type: "review:updated",
    agentId: "pm",
    description: "Review approved: pm",
    detail: "Clean design. Matches the product spec.",
    timestamp: ago(180),
  },
  {
    id: "11",
    type: "task:updated",
    agentId: "fe",
    description: "Task done: Design login page",
    timestamp: ago(170),
  },
];

const SERVERS: ServerEntry[] = [
  { url: "http://localhost:3456", label: "localhost:3456", status: "live", isActive: true },
];

type AgentStatus = "idle" | "working" | "waiting" | "done";

const AGENT_STATUSES: Partial<Record<AgentId, AgentStatus>> = {
  ["pm" as AgentId]: "idle",
  ["fe" as AgentId]: "working",
  ["be" as AgentId]: "working",
  ["qa" as AgentId]: "idle",
};

// Props for the MockProviders wrapper — mirrors the 4 context value shapes
interface MockProvidersProps {
  // SessionContext
  tasks?: Task[];
  messages?: Message[];
  agentStatuses?: Partial<Record<AgentId, AgentStatus>>;
  thinkingChunks?: Partial<Record<AgentId, string>>;
  selectedAgent?: AgentId | null;
  timeline?: TimelineEntry[];
  instanceId?: string | undefined;
  instancePort?: number | undefined;
  sessionTeam?: AgentMeta[];
  // ConnectionContext
  connected?: boolean;
  reconnecting?: boolean;
  attempt?: number;
  nextRetryIn?: number;
  // ServerContext
  servers?: ServerEntry[];
  activeServer?: string;
  // AgentsContext
  agents?: AgentMeta[];
  agentsLoading?: boolean;
  agentsError?: boolean;
  children: ReactNode;
}

// Wraps children with all 4 context providers using the given values (or defaults).
function MockProviders({
  tasks = TASKS,
  messages = MESSAGES,
  agentStatuses = AGENT_STATUSES,
  thinkingChunks = {},
  selectedAgent = null,
  timeline = TIMELINE,
  instanceId = "relay",
  instancePort = 3456,
  sessionTeam = AGENTS,
  connected = true,
  reconnecting = false,
  attempt = 0,
  nextRetryIn = 0,
  servers = SERVERS,
  activeServer = "http://localhost:3456",
  agents = AGENTS,
  agentsLoading = false,
  agentsError = false,
  children,
}: MockProvidersProps) {
  return (
    <SessionContext.Provider
      value={{
        tasks,
        messages,
        agentStatuses,
        thinkingChunks,
        selectedAgent,
        timeline,
        instanceId,
        instancePort,
        sessionTeam,
        liveSessionId: null,
        onSelectAgent: () => {},
      }}
    >
      <ConnectionContext.Provider
        value={{ connected, reconnecting, attempt, nextRetryIn, onRetryNow: () => {} }}
      >
        <ServerContext.Provider
          value={{
            servers,
            activeServer,
            onSwitchServer: () => {},
            onAddServer: () => {},
          }}
        >
          <AgentsContext.Provider value={{ agents, agentsLoading, agentsError }}>
            <PanelResizeProvider>{children}</PanelResizeProvider>
          </AgentsContext.Provider>
        </ServerContext.Provider>
      </ConnectionContext.Provider>
    </SessionContext.Provider>
  );
}

const meta = {
  component: AppLayout,
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story: () => ReactNode) => (
      <MockProviders>
        <Story />
      </MockProviders>
    ),
  ],
} satisfies Meta<typeof AppLayout>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Offline: Story = {
  decorators: [
    (Story: () => ReactNode) => (
      <MockProviders connected={false} reconnecting={true} attempt={2} nextRetryIn={8}>
        <Story />
      </MockProviders>
    ),
  ],
};

export const AgentsLoading: Story = {
  decorators: [
    (Story: () => ReactNode) => (
      <MockProviders agents={[]} agentsLoading={true} sessionTeam={[]}>
        <Story />
      </MockProviders>
    ),
  ],
};

export const WithThinking: Story = {
  decorators: [
    (Story: () => ReactNode) => (
      <MockProviders
        thinkingChunks={
          {
            fe: "Integrating the backend auth API... checking the token refresh flow with the new httpOnly cookie setup.",
            be: "Writing the JWT validation middleware...",
          } as Record<AgentId, string>
        }
      >
        <Story />
      </MockProviders>
    ),
  ],
};

export const FocusMode: Story = {
  decorators: [
    (Story: () => ReactNode) => (
      <MockProviders
        selectedAgent={"be" as AgentId}
        thinkingChunks={
          {
            be: "Implementing rate limiting with a sliding window algorithm...",
          } as Record<AgentId, string>
        }
      >
        <Story />
      </MockProviders>
    ),
  ],
};

export const Empty: Story = {
  decorators: [
    (Story: () => ReactNode) => (
      <MockProviders
        tasks={[]}
        messages={[]}
        timeline={[]}
        agentStatuses={{}}
        sessionTeam={[]}
        instanceId={undefined}
        instancePort={undefined}
      >
        <Story />
      </MockProviders>
    ),
  ],
};

export const AllDone: Story = {
  decorators: [
    (Story: () => ReactNode) => (
      <MockProviders
        tasks={TASKS.map((t) => ({ ...t, status: "done" as const }))}
        agentStatuses={
          {
            ["pm" as AgentId]: "done",
            ["fe" as AgentId]: "done",
            ["be" as AgentId]: "done",
            ["qa" as AgentId]: "done",
          } satisfies Partial<Record<AgentId, AgentStatus>>
        }
        timeline={[
          ...TIMELINE,
          {
            id: "end-fe",
            type: "message:new" as const,
            agentId: "fe",
            description: "Broadcast message",
            detail: "end:_done | all frontend tasks complete",
            timestamp: ago(30),
          },
          {
            id: "end-be",
            type: "message:new" as const,
            agentId: "be",
            description: "Broadcast message",
            detail: "end:_done | auth API complete",
            timestamp: ago(20),
          },
        ]}
      >
        <Story />
      </MockProviders>
    ),
  ],
};
