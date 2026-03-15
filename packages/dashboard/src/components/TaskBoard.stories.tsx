import type { Meta, StoryObj } from "@storybook/react";
import type { Task } from "../types";
import { TaskBoard } from "./TaskBoard";

const SAMPLE_TASKS: Task[] = [
  {
    id: "1",
    title: "Design login page",
    assignee: "designer",
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
    description: "JWT-based auth with refresh tokens and rate limiting",
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
    status: "in_review",
    priority: "medium",
    description: "Security review and penetration testing",
  },
  {
    id: "5",
    title: "Write E2E tests",
    assignee: "qa",
    status: "todo",
    priority: "medium",
  },
  {
    id: "6",
    title: "Deploy to staging",
    assignee: "deployer",
    status: "todo",
    priority: "low",
  },
  {
    id: "7",
    title: "Setup CI pipeline",
    assignee: "be",
    status: "todo",
    priority: "high",
  },
];

const meta = {
  component: TaskBoard,
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <div style={{ height: 480, display: "flex" }}>
        <Story />
      </div>
    ),
  ],
  args: {
    tasks: SAMPLE_TASKS,
  },
} satisfies Meta<typeof TaskBoard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Empty: Story = {
  args: { tasks: [] },
};

export const AllInProgress: Story = {
  args: {
    tasks: SAMPLE_TASKS.map((t) => ({ ...t, status: "in_progress" as const })),
  },
};

export const AllDone: Story = {
  args: {
    tasks: SAMPLE_TASKS.map((t) => ({ ...t, status: "done" as const })),
  },
};

export const CriticalPriority: Story = {
  args: {
    tasks: [
      {
        id: "c1",
        title: "Production incident — fix auth service crash",
        assignee: "be",
        status: "in_progress",
        priority: "critical",
        description: "Auth service is returning 500 on all login attempts since deploy #342",
      },
      {
        id: "c2",
        title: "Hotfix deployment",
        assignee: "deployer",
        status: "todo",
        priority: "critical",
      },
      {
        id: "c3",
        title: "Write regression test",
        assignee: "qa",
        status: "todo",
        priority: "high",
      },
    ],
  },
};
