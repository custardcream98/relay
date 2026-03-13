// src/agents/loader.test.ts
import { describe, expect, test } from "bun:test";
import { getWorkflow, loadAgents } from "./loader";
import type { AgentsFile } from "./types";

describe("agent loader", () => {
  test("loads agents.default.yml successfully", () => {
    const agents = loadAgents();
    expect(agents.pm).toBeDefined();
    expect(agents.fe).toBeDefined();
    expect(agents.be).toBeDefined();
    expect(agents.qa).toBeDefined();
  });

  test("pm agent has required fields", () => {
    const agents = loadAgents();
    expect(agents.pm.name).toBeTruthy();
    expect(agents.pm.systemPrompt).toBeTruthy();
    expect(agents.pm.tools.length).toBeGreaterThan(0);
  });

  test("overrides systemPrompt with custom yml", () => {
    const custom: AgentsFile = {
      agents: {
        pm: { systemPrompt: "Custom PM prompt" },
      },
    };
    const agents = loadAgents(custom);
    expect(agents.pm.systemPrompt).toBe("Custom PM prompt");
    // fields not overridden keep their default values
    expect(agents.pm.name).toBeTruthy();
  });

  test("inherits config from another agent via extends", () => {
    const custom: AgentsFile = {
      agents: {
        "fe-senior": {
          extends: "fe",
          name: "Senior Frontend Engineer",
          systemPrompt: "Senior FE prompt",
        },
      },
    };
    const agents = loadAgents(custom);
    expect(agents["fe-senior"]).toBeDefined();
    expect(agents["fe-senior"].name).toBe("Senior Frontend Engineer");
    // inherits tools from the extended fe agent
    expect(agents["fe-senior"].tools).toEqual(agents.fe.tools);
  });

  test("excludes agents with disabled: true", () => {
    const custom: AgentsFile = {
      agents: { designer: { disabled: true } },
    };
    const agents = loadAgents(custom);
    expect(agents.designer).toBeUndefined();
  });

  test("throws when extending a disabled agent", () => {
    const custom: AgentsFile = {
      agents: {
        be: { disabled: true },
        "be-custom": { extends: "be", name: "Custom BE" },
      },
    };
    expect(() => loadAgents(custom)).toThrow();
  });

  test("throws for custom agent without extends when required fields are missing", () => {
    const custom: AgentsFile = {
      agents: {
        "incomplete-agent": { name: "Missing fields" }, // missing tools and systemPrompt
      },
    };
    expect(() => loadAgents(custom)).toThrow();
  });
});

describe("language setting", () => {
  test("sets language per agent", () => {
    const custom: AgentsFile = {
      agents: { pm: { language: "Korean" } },
    };
    const agents = loadAgents(custom);
    expect(agents.pm.language).toBe("Korean");
    // other agents have no language set
    expect(agents.fe.language).toBeUndefined();
  });

  test("global language applies to all agents", () => {
    const custom: AgentsFile = {
      agents: {},
      language: "English",
    };
    const agents = loadAgents(custom);
    expect(agents.pm.language).toBe("English");
    expect(agents.fe.language).toBe("English");
    expect(agents.be.language).toBe("English");
  });

  test("per-agent language overrides global language", () => {
    const custom: AgentsFile = {
      agents: { pm: { language: "Korean" } },
      language: "English",
    };
    const agents = loadAgents(custom);
    expect(agents.pm.language).toBe("Korean");
    expect(agents.fe.language).toBe("English");
  });

  test("buildSystemPromptWithMemory includes language instruction", () => {
    const { buildSystemPromptWithMemory } = require("./loader");
    const persona = {
      id: "pm",
      name: "PM",
      emoji: "📋",
      tools: [],
      systemPrompt: "You are PM.",
      language: "Korean",
    };
    const prompt = buildSystemPromptWithMemory(persona, "/nonexistent");
    expect(prompt).toContain("You MUST respond in Korean");
  });

  test("no language instruction when language is not set", () => {
    const { buildSystemPromptWithMemory } = require("./loader");
    const persona = {
      id: "pm",
      name: "PM",
      emoji: "📋",
      tools: [],
      systemPrompt: "You are PM.",
    };
    const prompt = buildSystemPromptWithMemory(persona, "/nonexistent");
    expect(prompt).not.toContain("Language");
  });
});

describe("workflow loader", () => {
  test("loads default workflow successfully", () => {
    const workflow = getWorkflow();
    expect(workflow.jobs).toBeDefined();
    expect(Object.keys(workflow.jobs).length).toBeGreaterThan(0);
  });

  test("detects planning job as start (not a target in any end map)", () => {
    const workflow = getWorkflow();
    const allTargets = new Set(
      Object.values(workflow.jobs).flatMap((j) => Object.keys(j.end ?? {}))
    );
    const startJobs = Object.keys(workflow.jobs).filter((id) => !allTargets.has(id));
    expect(startJobs).toHaveLength(1);
    expect(startJobs[0]).toBe("planning");
  });

  test("overrides job end with custom workflow", () => {
    const custom: AgentsFile = {
      agents: {},
      workflow: {
        jobs: {
          qa: {
            description: "Custom QA",
            end: { deploy: "when tests pass", hotfix: "when a critical bug is found" },
          },
        },
      },
    };
    const workflow = getWorkflow(custom);
    expect(workflow.jobs.qa.description).toBe("Custom QA");
    expect(workflow.jobs.qa.end?.hotfix).toBeDefined();
    // other jobs keep their defaults
    expect(workflow.jobs.planning).toBeDefined();
  });
});
