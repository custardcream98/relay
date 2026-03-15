import type { Meta, StoryObj } from "@storybook/react";
import type { AgentId } from "../types";
import { AgentCard } from "./AgentCard";

const meta = {
  component: AgentCard,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <div style={{ width: 280 }}>
        <Story />
      </div>
    ),
  ],
  args: {
    id: "fe" as AgentId,
    name: "Frontend Engineer",
    emoji: "🎨",
    status: "idle",
    thinkingChunk: "",
    lastMessage: null,
    lastActivityTs: null,
    inProgressCount: 0,
    isSelected: false,
    onClick: () => {},
  },
} satisfies Meta<typeof AgentCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Idle: Story = {};

export const Working: Story = {
  args: {
    status: "working",
    thinkingChunk:
      "Implementing the login form with validation — checking input types and error states now...",
    inProgressCount: 2,
  },
};

export const Waiting: Story = {
  args: {
    status: "waiting",
    lastMessage: "end:waiting | waiting for BE to complete the auth API",
  },
};

export const Done: Story = {
  args: {
    status: "done",
    lastMessage: "end:_done | all frontend tasks complete",
  },
};

export const Selected: Story = {
  args: {
    isSelected: true,
    status: "working",
    thinkingChunk: "Writing unit tests for LoginForm component...",
    inProgressCount: 1,
  },
};

export const WithLastMessage: Story = {
  args: {
    status: "idle",
    lastMessage: "Handoff: login form complete, please review and connect to auth API",
    lastActivityTs: Date.now() - 5 * 60 * 1000, // 5m ago
  },
};

export const WithLastActivity: Story = {
  name: "With Last Activity Timestamp",
  args: {
    status: "waiting",
    lastMessage: "end:waiting | waiting for BE to finish auth API",
    lastActivityTs: Date.now() - 2 * 60 * 1000, // 2m ago
    inProgressCount: 0,
  },
};

// Extends agent — shows ID badge + base persona subtitle
export const ExtendsAgent: Story = {
  name: "Extends Agent (fe2 extends fe)",
  args: {
    id: "fe2" as AgentId,
    name: "Frontend Engineer",
    emoji: "🎨",
    basePersonaId: "fe",
    status: "working",
    thinkingChunk: "Implementing the login form...",
    inProgressCount: 1,
  },
};

// Multiple agents side by side — shows the color variety
export const AllAgents: Story = {
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, width: 280 }}>
      {(
        [
          { id: "pm", name: "Product Manager", emoji: "📋", status: "working" },
          { id: "fe", name: "Frontend Engineer", emoji: "🎨", status: "idle" },
          { id: "be", name: "Backend Engineer", emoji: "⚙️", status: "done" },
          { id: "qa", name: "QA Engineer", emoji: "🔍", status: "waiting" },
          { id: "designer", name: "Designer", emoji: "✏️", status: "idle" },
        ] as const
      ).map((agent) => (
        <AgentCard
          key={agent.id}
          id={agent.id as AgentId}
          name={agent.name}
          emoji={agent.emoji}
          status={agent.status}
          thinkingChunk=""
          lastMessage={null}
          lastActivityTs={null}
          inProgressCount={0}
          isSelected={false}
          onClick={() => {}}
        />
      ))}
    </div>
  ),
};
