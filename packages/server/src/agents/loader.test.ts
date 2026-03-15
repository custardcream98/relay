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

  test("throws when agent tools list contains unknown tool names", () => {
    const custom: AgentsFile = {
      agents: {
        bad_agent: {
          name: "Bad Agent",
          emoji: "🚫",
          tools: ["send_message", "nonexistent_tool", "another_fake_tool"],
          systemPrompt: "Agent with invalid tools.",
        },
      },
    };
    expect(() => loadAgents(custom)).toThrow(/unknown tools.*nonexistent_tool.*another_fake_tool/);
  });

  test("accepts agents with an empty tools list", () => {
    const custom: AgentsFile = {
      agents: {
        quiet_agent: {
          name: "Quiet Agent",
          emoji: "🔇",
          tools: [],
          systemPrompt: "Agent with no tools.",
        },
      },
    };
    const result = loadAgents(custom);
    expect(result.quiet_agent).toBeDefined();
    expect(result.quiet_agent.tools).toEqual([]);
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

  test("session agents can extend pool agents when poolAgents is provided", () => {
    // Simulates the pool defining a base persona and the session file extending it
    const poolFile: AgentsFile = {
      agents: {
        fe: {
          name: "Frontend Engineer",
          emoji: "🎨",
          tools: ["send_message", "get_messages"],
          systemPrompt: "You are a frontend engineer.",
          tags: ["frontend"],
        },
      },
    };
    const poolAgents = loadAgents(poolFile);

    const sessionFile: AgentsFile = {
      agents: {
        fe2: {
          extends: "fe",
          name: "Frontend Engineer 2",
        },
      },
    };

    const result = loadAgents(sessionFile, poolAgents);
    expect(result.fe2).toBeDefined();
    expect(result.fe2.emoji).toBe("🎨"); // inherited from pool
    expect(result.fe2.name).toBe("Frontend Engineer 2"); // overridden
    expect(result.fe2.systemPrompt).toBe("You are a frontend engineer."); // inherited from pool
  });

  test("extends still works within session file when poolAgents is provided", () => {
    const poolAgents = loadAgents({
      agents: {
        base: {
          name: "Base",
          emoji: "🔵",
          tools: ["send_message"],
          systemPrompt: "Base agent.",
        },
      },
    });

    const sessionFile: AgentsFile = {
      agents: {
        infile_base: {
          name: "In-file Base",
          emoji: "🟢",
          tools: ["send_message"],
          systemPrompt: "In-file base agent.",
        },
        derived: {
          extends: "infile_base",
          name: "Derived",
        },
      },
    };

    const result = loadAgents(sessionFile, poolAgents);
    expect(result.derived).toBeDefined();
    expect(result.derived.emoji).toBe("🟢"); // from same file, not pool
    expect(result.derived.name).toBe("Derived");
  });

  test("throws a useful error message when extends target is not found in file or pool", () => {
    const poolAgents = loadAgents({
      agents: {
        fe: {
          name: "Frontend Engineer",
          emoji: "🎨",
          tools: ["send_message"],
          systemPrompt: "You are a frontend engineer.",
        },
      },
    });

    const sessionFile: AgentsFile = {
      agents: {
        ghost: {
          extends: "nonexistent_agent",
          name: "Ghost",
        },
      },
    };

    expect(() => loadAgents(sessionFile, poolAgents)).toThrow(
      /extends target "nonexistent_agent" not found.*pool/
    );
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

describe("loadPool — no filesystem pool", () => {
  test("throws a clear error when no pool file is found and no override is provided", () => {
    // Point RELAY_DIR and RELAY_PROJECT_ROOT to a temp dir with no pool file
    const original_relay_dir = process.env.RELAY_DIR;
    const original_project_root = process.env.RELAY_PROJECT_ROOT;

    process.env.RELAY_DIR = "/tmp/relay-qa-test-nonexistent-dir";
    process.env.RELAY_PROJECT_ROOT = "/tmp/relay-qa-test-nonexistent-dir";

    try {
      expect(() => loadPool()).toThrow("No agent pool configured");
    } finally {
      // Always restore env vars to avoid bleeding into other tests
      if (original_relay_dir === undefined) {
        delete process.env.RELAY_DIR;
      } else {
        process.env.RELAY_DIR = original_relay_dir;
      }
      if (original_project_root === undefined) {
        delete process.env.RELAY_PROJECT_ROOT;
      } else {
        process.env.RELAY_PROJECT_ROOT = original_project_root;
      }
    }
  });
});

describe("buildSystemPromptWithMemory — memory injection", () => {
  test("injects project memory when project.md exists", async () => {
    const { mkdirSync, writeFileSync, rmSync } = await import("node:fs");
    const { join } = await import("node:path");
    const tmpDir = "/tmp/relay-qa-memory-test";
    mkdirSync(join(tmpDir, "memory"), { recursive: true });
    writeFileSync(join(tmpDir, "memory", "project.md"), "Project context here.");

    const persona = {
      id: markAsAgentId("writer"),
      name: "Writer",
      emoji: "✍️",
      tools: [],
      systemPrompt: "You are a writer.",
    };

    const prompt = buildSystemPromptWithMemory(persona, tmpDir);
    expect(prompt).toContain("Project Memory");
    expect(prompt).toContain("Project context here.");

    rmSync(tmpDir, { recursive: true, force: true });
  });

  test("injects agent-specific memory when agents/{id}.md exists", async () => {
    const { mkdirSync, writeFileSync, rmSync } = await import("node:fs");
    const { join } = await import("node:path");
    const tmpDir = "/tmp/relay-qa-agent-memory-test";
    mkdirSync(join(tmpDir, "memory", "agents"), { recursive: true });
    writeFileSync(join(tmpDir, "memory", "agents", "analyst.md"), "Analyst personal notes.");

    const persona = {
      id: markAsAgentId("analyst"),
      name: "Analyst",
      emoji: "📊",
      tools: [],
      systemPrompt: "You are an analyst.",
    };

    const prompt = buildSystemPromptWithMemory(persona, tmpDir);
    expect(prompt).toContain("My Memory");
    expect(prompt).toContain("Analyst personal notes.");

    rmSync(tmpDir, { recursive: true, force: true });
  });

  test("returns only system prompt when no memory files exist", () => {
    const persona = {
      id: markAsAgentId("ghost"),
      name: "Ghost",
      emoji: "👻",
      tools: [],
      systemPrompt: "You are a ghost.",
    };
    const prompt = buildSystemPromptWithMemory(persona, "/tmp/relay-qa-no-memory-at-all-xyz");
    expect(prompt).toBe("You are a ghost.");
  });

  test("injects lessons.md as team retrospectives section", async () => {
    const { mkdirSync, writeFileSync, rmSync } = await import("node:fs");
    const { join } = await import("node:path");
    const tmpDir = "/tmp/relay-qa-lessons-test";
    mkdirSync(join(tmpDir, "memory"), { recursive: true });
    writeFileSync(join(tmpDir, "memory", "lessons.md"), "Lesson: always write tests.");

    const persona = {
      id: markAsAgentId("dev"),
      name: "Dev",
      emoji: "💻",
      tools: [],
      systemPrompt: "You are a developer.",
    };

    const prompt = buildSystemPromptWithMemory(persona, tmpDir);
    expect(prompt).toContain("Team Retrospectives");
    expect(prompt).toContain("Lesson: always write tests.");

    rmSync(tmpDir, { recursive: true, force: true });
  });

  test("injects all three memory sources when all files exist", async () => {
    const { mkdirSync, writeFileSync, rmSync } = await import("node:fs");
    const { join } = await import("node:path");
    const tmpDir = "/tmp/relay-qa-all-memory-test";
    mkdirSync(join(tmpDir, "memory", "agents"), { recursive: true });
    writeFileSync(join(tmpDir, "memory", "project.md"), "Project: relay.");
    writeFileSync(join(tmpDir, "memory", "lessons.md"), "Lessons learned here.");
    writeFileSync(join(tmpDir, "memory", "agents", "writer.md"), "Writer personal notes.");

    const persona = {
      id: markAsAgentId("writer"),
      name: "Writer",
      emoji: "✍️",
      tools: [],
      systemPrompt: "You are a writer.",
    };

    const prompt = buildSystemPromptWithMemory(persona, tmpDir);
    expect(prompt).toContain("Project Memory");
    expect(prompt).toContain("Team Retrospectives");
    expect(prompt).toContain("My Memory");

    rmSync(tmpDir, { recursive: true, force: true });
  });
});
