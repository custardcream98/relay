// packages/server/src/agents/loader.test.ts
import { describe, expect, test } from "bun:test";
import { markAsAgentId } from "@custardcream/relay-shared";
import { buildSystemPromptWithMemory, getWorkflow, loadAgents, loadPool } from "./loader";
import type { AgentsFile } from "./types";

describe("loadAgents", () => {
  test("loads successfully with explicit agent file", () => {
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
      id: markAsAgentId("writer"),
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
      id: markAsAgentId("writer"),
      name: "Writer",
      emoji: "✍️",
      tools: [],
      systemPrompt: "You are a writer.",
    };
    const prompt = buildSystemPromptWithMemory(persona, "/nonexistent");
    expect(prompt).not.toContain("Language");
  });
});

describe("loadPool", () => {
  test("returns agents when a pool override is provided", () => {
    const poolFile: AgentsFile = {
      agents: {
        analyst: {
          name: "Analyst",
          emoji: "📊",
          tools: ["send_message", "get_messages"],
          systemPrompt: "You are an analyst.",
          tags: ["research", "data"],
        },
        writer: {
          name: "Writer",
          emoji: "✍️",
          tools: ["send_message"],
          systemPrompt: "You are a writer.",
          tags: ["marketing", "content"],
        },
      },
    };
    const pool = loadPool(poolFile);
    expect(pool.analyst).toBeDefined();
    expect(pool.analyst.name).toBe("Analyst");
    expect(pool.analyst.tags).toEqual(["research", "data"]);
    expect(pool.writer).toBeDefined();
  });

  test("loads successfully with explicit override (no filesystem access needed)", () => {
    // We cannot control the filesystem in unit tests, so we test via override path.
    const minimalPool: AgentsFile = {
      agents: {
        helper: {
          name: "Helper",
          emoji: "🤝",
          tools: ["send_message"],
          systemPrompt: "You help the team.",
        },
      },
    };
    const pool = loadPool(minimalPool);
    expect(Object.keys(pool).length).toBeGreaterThan(0);
  });

  test("preserves tags field on pool agents", () => {
    const poolFile: AgentsFile = {
      agents: {
        seo: {
          name: "SEO Specialist",
          emoji: "🔍",
          tools: ["send_message"],
          systemPrompt: "You optimize for search.",
          tags: ["marketing", "seo", "content"],
        },
      },
    };
    const pool = loadPool(poolFile);
    expect(pool.seo.tags).toEqual(["marketing", "seo", "content"]);
  });

  test("excludes disabled agents from pool", () => {
    const poolFile: AgentsFile = {
      agents: {
        active: {
          name: "Active",
          emoji: "✅",
          tools: ["send_message"],
          systemPrompt: "Active agent.",
        },
        inactive: {
          name: "Inactive",
          emoji: "❌",
          tools: [],
          systemPrompt: "Disabled.",
          disabled: true,
        },
      },
    };
    const pool = loadPool(poolFile);
    expect(pool.active).toBeDefined();
    expect(pool.inactive).toBeUndefined();
  });

  test("pool agents can use extends", () => {
    const poolFile: AgentsFile = {
      agents: {
        base_researcher: {
          name: "Researcher",
          emoji: "🔬",
          tools: ["send_message", "get_messages"],
          systemPrompt: "You are a researcher.",
          tags: ["research"],
        },
        senior_researcher: {
          extends: "base_researcher",
          name: "Senior Researcher",
          tags: ["research", "senior"],
        },
      },
    };
    const pool = loadPool(poolFile);
    expect(pool.senior_researcher).toBeDefined();
    expect(pool.senior_researcher.emoji).toBe("🔬"); // inherited
    expect(pool.senior_researcher.name).toBe("Senior Researcher"); // overridden
    expect(pool.senior_researcher.tags).toEqual(["research", "senior"]); // overridden
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
