// packages/server/src/agents/loader.test.ts
import { describe, expect, test } from "bun:test";
import { buildSystemPromptWithMemory, getWorkflow, loadAgents } from "./loader";
import type { AgentsFile } from "./types";

describe("loadAgents", () => {
  test("throws a clear error when 0 agents are defined", () => {
    const emptyFile: AgentsFile = { agents: {} };
    expect(() => loadAgents(emptyFile)).toThrow("No agents defined");
  });

  test("loads successfully when agents.yml has agents", () => {
    const customFile: AgentsFile = {
      agents: {
        researcher: {
          name: "Researcher",
          emoji: "🔬",
          tools: ["send_message", "get_messages", "get_team_status"],
          systemPrompt: "You are a researcher.",
        },
      },
    };
    const result = loadAgents(customFile);
    expect(result.researcher).toBeDefined();
    expect(result.researcher.name).toBe("Researcher");
  });

  test("can inherit from another agent using extends", () => {
    const customFile: AgentsFile = {
      agents: {
        researcher: {
          name: "Researcher",
          emoji: "🔬",
          tools: ["send_message"],
          systemPrompt: "You are a researcher.",
        },
        peer_reviewer: {
          extends: "researcher",
          name: "Peer Reviewer",
        },
      },
    };
    const result = loadAgents(customFile);
    expect(result.peer_reviewer.emoji).toBe("🔬"); // inherited
    expect(result.peer_reviewer.name).toBe("Peer Reviewer"); // overridden
  });

  test("disabled agents are excluded from results", () => {
    const custom: AgentsFile = {
      agents: {
        writer: {
          name: "Writer",
          emoji: "✍️",
          tools: ["send_message"],
          systemPrompt: "You are a writer.",
        },
        editor: { disabled: true, name: "Editor", emoji: "📝", tools: [], systemPrompt: "Editor." },
      },
    };
    const agents = loadAgents(custom);
    expect(agents.writer).toBeDefined();
    expect(agents.editor).toBeUndefined();
  });

  test("throws when extending a disabled agent", () => {
    const custom: AgentsFile = {
      agents: {
        base: { disabled: true, name: "Base", emoji: "🔵", tools: [], systemPrompt: "Base." },
        derived: { extends: "base", name: "Derived" },
      },
    };
    expect(() => loadAgents(custom)).toThrow();
  });

  test("throws when required fields are missing without extends", () => {
    const custom: AgentsFile = {
      agents: {
        "incomplete-agent": { name: "Missing fields" }, // tools and systemPrompt omitted
      },
    };
    expect(() => loadAgents(custom)).toThrow();
  });
});

describe("language setting", () => {
  test("can set per-agent language", () => {
    const custom: AgentsFile = {
      agents: {
        writer: {
          name: "Writer",
          emoji: "✍️",
          tools: ["send_message"],
          systemPrompt: "You are a writer.",
          language: "Korean",
        },
        analyst: {
          name: "Analyst",
          emoji: "📊",
          tools: ["get_messages"],
          systemPrompt: "You are an analyst.",
        },
      },
    };
    const agents = loadAgents(custom);
    expect(agents.writer.language).toBe("Korean");
    expect(agents.analyst.language).toBeUndefined();
  });

  test("global language applies to all agents", () => {
    const custom: AgentsFile = {
      agents: {
        writer: {
          name: "Writer",
          emoji: "✍️",
          tools: ["send_message"],
          systemPrompt: "You are a writer.",
        },
        analyst: {
          name: "Analyst",
          emoji: "📊",
          tools: ["get_messages"],
          systemPrompt: "You are an analyst.",
        },
      },
      language: "English",
    };
    const agents = loadAgents(custom);
    expect(agents.writer.language).toBe("English");
    expect(agents.analyst.language).toBe("English");
  });

  test("per-agent language takes precedence over global language", () => {
    const custom: AgentsFile = {
      agents: {
        writer: {
          name: "Writer",
          emoji: "✍️",
          tools: ["send_message"],
          systemPrompt: "You are a writer.",
          language: "Korean",
        },
        analyst: {
          name: "Analyst",
          emoji: "📊",
          tools: ["get_messages"],
          systemPrompt: "You are an analyst.",
        },
      },
      language: "English",
    };
    const agents = loadAgents(custom);
    expect(agents.writer.language).toBe("Korean");
    expect(agents.analyst.language).toBe("English");
  });

  test("buildSystemPromptWithMemory includes language directive", () => {
    const persona = {
      id: "writer",
      name: "Writer",
      emoji: "✍️",
      tools: [],
      systemPrompt: "You are a writer.",
      language: "Korean",
    };
    const prompt = buildSystemPromptWithMemory(persona, "/nonexistent");
    expect(prompt).toContain("You MUST respond in Korean");
  });

  test("omits language directive when language is not set", () => {
    const persona = {
      id: "writer",
      name: "Writer",
      emoji: "✍️",
      tools: [],
      systemPrompt: "You are a writer.",
    };
    const prompt = buildSystemPromptWithMemory(persona, "/nonexistent");
    expect(prompt).not.toContain("Language");
  });
});

describe("workflow loader", () => {
  test("returns empty jobs when no custom workflow is defined", () => {
    const workflow = getWorkflow({ agents: {} });
    expect(workflow.jobs).toBeDefined();
  });

  test("can override workflow jobs", () => {
    const custom: AgentsFile = {
      agents: {},
      workflow: {
        jobs: {
          research: {
            description: "Research phase",
            end: { review: "When research is complete" },
          },
        },
      },
    };
    const workflow = getWorkflow(custom);
    expect(workflow.jobs.research).toBeDefined();
    expect(workflow.jobs.research.description).toBe("Research phase");
  });
});
