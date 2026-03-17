// packages/server/src/agents/loader.test.ts
import { describe, expect, test } from "bun:test";
import { loadAgents, loadPool, validatePromptSections } from "./loader";
import type { AgentsFile } from "./types";

/** Wraps a short description with required prompt sections for pool validation. */
const poolPrompt = (desc: string) =>
  `${desc}\n### On Each Spawn\nCheck messages.\n### Declaring End\nDeclare end.\n## Rules\nFollow rules.`;

describe("loadAgents", () => {
  test("loads successfully with explicit agent file", () => {
    const customFile: AgentsFile = {
      agents: {
        researcher: {
          name: "Researcher",
          emoji: "🔬",
          tools: ["send_message", "get_messages", "get_all_tasks"],
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

  test("hooks string is normalized to string[]", () => {
    const custom: AgentsFile = {
      agents: {
        fe: {
          name: "Frontend",
          emoji: "💻",
          tools: ["send_message"],
          systemPrompt: "You are a frontend engineer.",
          hooks: { before_task: "echo before", after_task: "echo after" },
        },
      },
    };
    const result = loadAgents(custom);
    expect(result.fe.hooks?.before_task).toEqual(["echo before"]);
    expect(result.fe.hooks?.after_task).toEqual(["echo after"]);
  });

  test("hooks array stays as string[]", () => {
    const custom: AgentsFile = {
      agents: {
        fe: {
          name: "Frontend",
          emoji: "💻",
          tools: ["send_message"],
          systemPrompt: "You are a frontend engineer.",
          hooks: { before_task: ["cmd1", "cmd2"], after_task: [] },
        },
      },
    };
    const result = loadAgents(custom);
    expect(result.fe.hooks?.before_task).toEqual(["cmd1", "cmd2"]);
    expect(result.fe.hooks?.after_task).toEqual([]);
  });

  test("hooks are inherited via extends", () => {
    const custom: AgentsFile = {
      agents: {
        fe: {
          name: "Frontend",
          emoji: "💻",
          tools: ["send_message"],
          systemPrompt: "You are a frontend engineer.",
          hooks: { before_task: "echo before", after_task: "echo after" },
        },
        fe2: {
          extends: "fe",
          name: "Frontend 2",
        },
      },
    };
    const result = loadAgents(custom);
    // fe2 inherits hooks from fe
    expect(result.fe2.hooks?.before_task).toEqual(["echo before"]);
    expect(result.fe2.hooks?.after_task).toEqual(["echo after"]);
  });

  test("hooks: false opts out of inherited hooks", () => {
    const custom: AgentsFile = {
      agents: {
        fe: {
          name: "Frontend",
          emoji: "💻",
          tools: ["send_message"],
          systemPrompt: "You are a frontend engineer.",
          hooks: { before_task: "echo before" },
        },
        fe2: {
          extends: "fe",
          name: "Frontend 2",
          hooks: false,
        },
      },
    };
    const result = loadAgents(custom);
    // fe2 explicitly opts out of inherited hooks
    expect(result.fe2.hooks).toBeUndefined();
    // fe still has its hooks
    expect(result.fe.hooks?.before_task).toEqual(["echo before"]);
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

  // --- Agent ID validation (YAML key with invalid characters) ---
  // TypeScript types enforce string keys at compile time, but the YAML parser produces
  // raw string keys that bypass type checking. loadAgents() must reject them at runtime.

  test("throws when agent id contains a space", () => {
    const custom = {
      agents: {
        "bad agent": {
          name: "Bad Agent",
          emoji: "🚫",
          tools: [],
          systemPrompt: "Invalid ID.",
        },
      },
    } as unknown as AgentsFile;
    expect(() => loadAgents(custom)).toThrow(/invalid characters/);
  });

  test("throws when agent id contains a slash (path traversal attempt)", () => {
    const custom = {
      agents: {
        "fe/hack": {
          name: "Hack Agent",
          emoji: "💀",
          tools: [],
          systemPrompt: "Path traversal.",
        },
      },
    } as unknown as AgentsFile;
    expect(() => loadAgents(custom)).toThrow(/invalid characters/);
  });

  test("throws when agent id contains dots (e.g. '../evil')", () => {
    const custom = {
      agents: {
        "../evil": {
          name: "Evil Agent",
          emoji: "💀",
          tools: [],
          systemPrompt: "Path traversal.",
        },
      },
    } as unknown as AgentsFile;
    expect(() => loadAgents(custom)).toThrow(/invalid characters/);
  });

  test("throws when extends agent id contains invalid characters", () => {
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
    const custom = {
      agents: {
        "bad id": {
          extends: "base",
          name: "Bad ID Agent",
        },
      },
    } as unknown as AgentsFile;
    expect(() => loadAgents(custom, poolAgents)).toThrow(/invalid characters/);
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
});

describe("loadPool", () => {
  test("returns agents when a pool override is provided", () => {
    const poolFile: AgentsFile = {
      agents: {
        analyst: {
          name: "Analyst",
          emoji: "📊",
          tools: ["send_message", "get_messages"],
          systemPrompt: poolPrompt("You are an analyst."),
          tags: ["research", "data"],
        },
        writer: {
          name: "Writer",
          emoji: "✍️",
          tools: ["send_message"],
          systemPrompt: poolPrompt("You are a writer."),
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
          systemPrompt: poolPrompt("You help the team."),
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
          systemPrompt: poolPrompt("You optimize for search."),
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
          systemPrompt: poolPrompt("Active agent."),
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

  test("throws when pool agent is missing required prompt sections", () => {
    const poolFile: AgentsFile = {
      agents: {
        bad: {
          name: "Bad Agent",
          emoji: "🚫",
          tools: ["send_message"],
          systemPrompt: "No required sections here.",
        },
      },
    };
    expect(() => loadPool(poolFile)).toThrow(/missing required sections/);
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
          systemPrompt: poolPrompt("You are a researcher."),
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

describe("validatePromptSections", () => {
  test("does not throw when all sections present", () => {
    expect(() =>
      validatePromptSections(
        "test",
        "### On Each Spawn\nstuff\n### Declaring End\nstuff\n## Rules\nstuff"
      )
    ).not.toThrow();
  });

  test("throws for missing sections", () => {
    expect(() => validatePromptSections("test", "Just a simple prompt.")).toThrow(
      /missing required sections.*On Each Spawn.*Declaring End.*Rules/
    );
  });

  test("throws naming the specific missing section", () => {
    expect(() =>
      validatePromptSections("fe", "### On Each Spawn\nstuff\n### Declaring End\nstuff")
    ).toThrow(/agent "fe".*missing required sections.*"Rules"/);
  });
});

describe("shared_blocks — loadAgents integration", () => {
  test("resolves shared_blocks in base agent systemPrompts", () => {
    const custom: AgentsFile = {
      shared_blocks: {
        rules: '## Rules\nAlways set agent_id to "{agent_id}".',
      },
      agents: {
        fe: {
          name: "Frontend",
          emoji: "💻",
          tools: ["send_message"],
          systemPrompt:
            "You are FE.\n### On Each Spawn\nCheck messages.\n### Declaring End\nDone.\n{{rules}}",
        },
      },
    };
    const result = loadAgents(custom);
    expect(result.fe.systemPrompt).toContain('Always set agent_id to "fe".');
    expect(result.fe.systemPrompt).not.toContain("{{rules}}");
  });

  test("resolves shared_blocks in extends agent that overrides systemPrompt", () => {
    const custom: AgentsFile = {
      shared_blocks: {
        core: "Core block for {agent_id}",
      },
      agents: {
        base: {
          name: "Base",
          emoji: "🔵",
          tools: ["send_message"],
          systemPrompt:
            "Base prompt.\n### On Each Spawn\n...\n### Declaring End\n...\n## Rules\n{{core}}",
        },
        derived: {
          extends: "base",
          name: "Derived",
          systemPrompt:
            "Derived prompt.\n### On Each Spawn\n...\n### Declaring End\n...\n## Rules\n{{core}}",
        },
      },
    };
    const result = loadAgents(custom);
    expect(result.base.systemPrompt).toContain("Core block for base");
    expect(result.derived.systemPrompt).toContain("Core block for derived");
  });

  test("extends agent without systemPrompt override inherits already-resolved prompt", () => {
    const custom: AgentsFile = {
      shared_blocks: {
        tag: "Resolved for {agent_id}",
      },
      agents: {
        base: {
          name: "Base",
          emoji: "🔵",
          tools: ["send_message"],
          systemPrompt: "### On Each Spawn\n...\n### Declaring End\n...\n## Rules\n{{tag}}",
        },
        copy: {
          extends: "base",
          name: "Copy",
        },
      },
    };
    const result = loadAgents(custom);
    // base gets its own id substituted
    expect(result.base.systemPrompt).toContain("Resolved for base");
    // copy inherits base's already-resolved prompt (no double-substitution)
    expect(result.copy.systemPrompt).toContain("Resolved for base");
  });

  test("throws on undefined shared_block reference", () => {
    const custom: AgentsFile = {
      shared_blocks: {},
      agents: {
        fe: {
          name: "FE",
          emoji: "💻",
          tools: ["send_message"],
          systemPrompt: "{{undefined_block}}",
        },
      },
    };
    expect(() => loadAgents(custom)).toThrow(/shared_blocks reference "{{undefined_block}}"/);
  });

  test("shared_blocks + review_checklist work together in extends chain", () => {
    const custom: AgentsFile = {
      shared_blocks: {
        rules: '## Rules\nAlways set agent_id to "{agent_id}".',
      },
      review_checklist: "Global checklist",
      agents: {
        fe: {
          name: "FE",
          emoji: "💻",
          tools: ["send_message"],
          systemPrompt: "FE prompt.\n### On Each Spawn\n...\n### Declaring End\n...\n{{rules}}",
          review_checklist: "FE checklist",
        },
        fe2: {
          extends: "fe",
          name: "FE 2",
          // inherits resolved prompt from fe, inherits fe's review_checklist over global
        },
      },
    };
    const result = loadAgents(custom);
    // shared_blocks resolved with base agent's id
    expect(result.fe.systemPrompt).toContain('agent_id to "fe"');
    // fe2 inherits already-resolved prompt (contains fe's id, not fe2's)
    expect(result.fe2.systemPrompt).toContain('agent_id to "fe"');
    // review_checklist: fe2 inherits fe's per-agent checklist, not global
    expect(result.fe.review_checklist).toBe("FE checklist");
    expect(result.fe2.review_checklist).toBe("FE checklist");
  });

  test("works without shared_blocks", () => {
    const custom: AgentsFile = {
      agents: {
        fe: {
          name: "FE",
          emoji: "💻",
          tools: ["send_message"],
          systemPrompt: "Plain prompt with no blocks.",
        },
      },
    };
    const result = loadAgents(custom);
    expect(result.fe.systemPrompt).toBe("Plain prompt with no blocks.");
  });
});

// ─── review_checklist tests ───────────────────────────────────────────────────

describe("review_checklist", () => {
  test("global review_checklist applies to all agents", () => {
    const custom: AgentsFile = {
      review_checklist: "- [ ] No TypeScript any\n- [ ] No console.log",
      agents: {
        fe: {
          name: "FE",
          emoji: "💻",
          tools: ["send_message"],
          systemPrompt: "FE prompt.",
        },
        be: {
          name: "BE",
          emoji: "⚙️",
          tools: ["send_message"],
          systemPrompt: "BE prompt.",
        },
      },
    };
    const result = loadAgents(custom);
    expect(result.fe.review_checklist).toBe("- [ ] No TypeScript any\n- [ ] No console.log");
    expect(result.be.review_checklist).toBe("- [ ] No TypeScript any\n- [ ] No console.log");
  });

  test("per-agent review_checklist overrides global", () => {
    const custom: AgentsFile = {
      review_checklist: "Global checklist",
      agents: {
        fe: {
          name: "FE",
          emoji: "💻",
          tools: ["send_message"],
          systemPrompt: "FE prompt.",
          review_checklist: "FE-specific checklist",
        },
        be: {
          name: "BE",
          emoji: "⚙️",
          tools: ["send_message"],
          systemPrompt: "BE prompt.",
        },
      },
    };
    const result = loadAgents(custom);
    expect(result.fe.review_checklist).toBe("FE-specific checklist");
    expect(result.be.review_checklist).toBe("Global checklist");
  });

  test("review_checklist is undefined when not set", () => {
    const custom: AgentsFile = {
      agents: {
        fe: {
          name: "FE",
          emoji: "💻",
          tools: ["send_message"],
          systemPrompt: "FE prompt.",
        },
      },
    };
    const result = loadAgents(custom);
    expect(result.fe.review_checklist).toBeUndefined();
  });

  test("extends agent inherits review_checklist from global", () => {
    const custom: AgentsFile = {
      review_checklist: "Global checklist",
      agents: {
        base: {
          name: "Base",
          emoji: "🔵",
          tools: ["send_message"],
          systemPrompt: "Base prompt.",
        },
        derived: {
          extends: "base",
          name: "Derived",
        },
      },
    };
    const result = loadAgents(custom);
    expect(result.derived.review_checklist).toBe("Global checklist");
  });

  test("extends agent inherits base review_checklist over global", () => {
    const custom: AgentsFile = {
      review_checklist: "Global checklist",
      agents: {
        base: {
          name: "Base",
          emoji: "🔵",
          tools: ["send_message"],
          systemPrompt: "Base prompt.",
          review_checklist: "Base-specific checklist",
        },
        derived: {
          extends: "base",
          name: "Derived",
          // does NOT set review_checklist — should inherit base's, not global
        },
      },
    };
    const result = loadAgents(custom);
    expect(result.base.review_checklist).toBe("Base-specific checklist");
    expect(result.derived.review_checklist).toBe("Base-specific checklist");
  });

  test("extends agent can override review_checklist", () => {
    const custom: AgentsFile = {
      review_checklist: "Global checklist",
      agents: {
        base: {
          name: "Base",
          emoji: "🔵",
          tools: ["send_message"],
          systemPrompt: "Base prompt.",
          review_checklist: "Base checklist",
        },
        derived: {
          extends: "base",
          name: "Derived",
          review_checklist: "Derived checklist",
        },
      },
    };
    const result = loadAgents(custom);
    expect(result.base.review_checklist).toBe("Base checklist");
    expect(result.derived.review_checklist).toBe("Derived checklist");
  });
});
