import type { Meta, StoryObj } from "@storybook/react";
import { ServerContext } from "../context/ServerContext";
import type { AgentId, TimelineEntry } from "../types";
import { ActivityFeed } from "./ActivityFeed";

const now = Date.now();
const ago = (s: number) => now - s * 1000;

const ENTRIES: TimelineEntry[] = [
  {
    id: "1",
    type: "message:new",
    agentId: "pm",
    description: "Broadcast message",
    detail: "Session started. I'll analyze requirements and create tasks.",
    timestamp: ago(420),
  },
  {
    id: "2",
    type: "task:updated",
    agentId: "pm",
    description: "Task todo: Design login page",
    timestamp: ago(400),
  },
  {
    id: "3",
    type: "task:updated",
    agentId: "pm",
    description: "Task todo: Implement auth API",
    timestamp: ago(398),
  },
  {
    id: "4",
    type: "task:updated",
    agentId: "pm",
    description: "Task todo: Frontend login form",
    timestamp: ago(396),
  },
  {
    id: "5",
    type: "message:new",
    agentId: "fe",
    description: "Broadcast message",
    detail: "Claiming the design task. Starting now.",
    timestamp: ago(380),
  },
  {
    id: "6",
    type: "task:updated",
    agentId: "fe",
    description: "Task in progress: Design login page",
    timestamp: ago(378),
  },
  {
    id: "7",
    type: "message:new",
    agentId: "be",
    description: "→ pm",
    detail: "Clarifying: should the refresh token be stored in httpOnly cookie or localStorage?",
    timestamp: ago(360),
  },
  {
    id: "8",
    type: "message:new",
    agentId: "pm",
    description: "→ be",
    detail: "Use httpOnly cookie for security. The spec says cookies with SameSite=Strict.",
    timestamp: ago(350),
  },
  {
    id: "9",
    type: "message:new",
    agentId: "be",
    description: "Broadcast message",
    detail: "Working on auth API. JWT in header, refresh token in httpOnly cookie.",
    timestamp: ago(340),
  },
  {
    id: "10",
    type: "artifact:posted",
    agentId: "fe",
    description: "Artifact: login-design-spec",
    detail: "a1b2c3d4-mock-artifact-id",
    timestamp: ago(200),
  },
  {
    id: "11",
    type: "review:requested",
    agentId: "fe",
    description: "Review requested from pm",
    timestamp: ago(195),
  },
  {
    id: "12",
    type: "review:updated",
    agentId: "pm",
    description: "Review approved: pm",
    detail: "Clean design. Matches the product spec. Ship it.",
    timestamp: ago(180),
  },
  {
    id: "13",
    type: "message:new",
    agentId: "be",
    description: "Broadcast message",
    detail: "Completed: auth API with JWT, refresh tokens, rate limiting, and session revocation.",
    timestamp: ago(90),
  },
  {
    id: "14",
    type: "task:updated",
    agentId: "be",
    description: "Task done: Implement auth API",
    timestamp: ago(88),
  },
  {
    id: "15",
    type: "memory:updated",
    agentId: "be",
    description: "Memory updated",
    timestamp: ago(85),
  },
  {
    id: "16",
    type: "message:new",
    agentId: "be",
    description: "Broadcast message",
    detail: "end:_done | completed all backend tasks",
    timestamp: ago(80),
  },
  {
    id: "17",
    type: "message:new",
    agentId: "fe",
    description: "Broadcast message",
    detail: "end:waiting | waiting for BE API to integrate login form",
    timestamp: ago(60),
  },
];

// Mock artifact content returned by /api/artifacts/:id
const MOCK_ARTIFACT_RESPONSE = JSON.stringify({
  success: true,
  artifact: {
    id: "a1b2c3d4-mock-artifact-id",
    name: "login-design-spec",
    type: "figma_spec",
    content:
      "# Login Page Design Spec\n\n## Screens\n1. **Login form** — email + password\n2. **Loading state** — spinner overlay\n3. **Error state** — inline validation\n\n## Components\n- `LoginForm` — Zod validation\n- `PasswordInput` — toggleable visibility\n- `SocialLoginButtons` — Google, GitHub\n\n## Edge Cases\n- Empty state: submit disabled\n- Rate limit: countdown after 5 attempts",
    created_by: "fe",
    task_id: null,
    created_at: Math.floor(Date.now() / 1000) - 200,
  },
});

const meta = {
  component: ActivityFeed,
  parameters: { layout: "fullscreen" },
  decorators: [
    // Mock fetch for artifact detail API
    (Story) => {
      const origFetch = window.fetch;
      window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input.toString();
        if (url.includes("/api/artifacts/")) {
          return new Promise((resolve) =>
            setTimeout(
              () =>
                resolve(
                  new Response(MOCK_ARTIFACT_RESPONSE, {
                    headers: { "Content-Type": "application/json" },
                  })
                ),
              150
            )
          );
        }
        return origFetch(input, init);
      };
      return <Story />;
    },
    // ServerContext required by useServer() in ActivityFeed
    (Story) => (
      <ServerContext.Provider
        value={{
          servers: [{ url: "", label: "local", status: "live", isActive: true }],
          activeServer: "",
          onSwitchServer: () => {},
          onAddServer: () => {},
        }}
      >
        <div style={{ height: 600, display: "flex", flexDirection: "column" }}>
          <Story />
        </div>
      </ServerContext.Provider>
    ),
  ],
  args: {
    entries: ENTRIES,
    focusAgent: null,
    thinkingChunks: {},
    totalEventCount: 0,
    agentStatuses: {
      pm: "idle",
      fe: "waiting",
      be: "done",
    } as Record<AgentId, "idle" | "working" | "waiting" | "done">,
  },
} satisfies Meta<typeof ActivityFeed>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Empty: Story = {
  args: { entries: [] },
};

export const WithLiveThinking: Story = {
  args: {
    thinkingChunks: {
      fe: "Integrating the backend auth API... checking the token refresh flow with the new httpOnly cookie setup. Need to handle 401 responses gracefully.",
    } as Record<AgentId, string>,
    agentStatuses: {
      pm: "idle",
      fe: "working",
      be: "done",
    } as Record<AgentId, "idle" | "working" | "waiting" | "done">,
  },
};

export const FocusedOnAgent: Story = {
  args: {
    focusAgent: "be" as AgentId,
  },
};

export const EndDeclarations: Story = {
  name: "End Declarations — visual attribution",
  args: {
    entries: [
      {
        id: "a",
        type: "message:new",
        agentId: "pm",
        description: "Broadcast message",
        detail: "All tasks created. Team has enough context to proceed.",
        timestamp: ago(120),
      },
      {
        id: "b",
        type: "message:new",
        agentId: "be",
        description: "Broadcast message",
        detail: "Just shipped the auth module. All tests pass.",
        timestamp: ago(60),
      },
      {
        id: "c",
        type: "message:new",
        agentId: "fe",
        description: "Broadcast message",
        detail: "end:waiting | waiting for be to finish auth API",
        timestamp: ago(55),
      },
      {
        id: "d",
        type: "message:new",
        agentId: "be",
        description: "Broadcast message",
        detail: "end:_done | auth API complete, docs written",
        timestamp: ago(50),
      },
      {
        id: "e",
        type: "message:new",
        agentId: "pm",
        description: "Broadcast message",
        detail: "end:_done | all tasks complete, session wrap-up done",
        timestamp: ago(45),
      },
    ] satisfies TimelineEntry[],
    agentStatuses: {
      pm: "done",
      fe: "waiting",
      be: "done",
    } as Record<AgentId, "idle" | "working" | "waiting" | "done">,
  },
};
