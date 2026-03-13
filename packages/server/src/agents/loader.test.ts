// packages/server/src/agents/loader.test.ts
import { describe, expect, test } from "bun:test";
import { getWorkflow, loadAgents } from "./loader";
import type { AgentsFile } from "./types";

describe("loadAgents", () => {
  test("에이전트가 0개이면 명확한 에러를 던진다", () => {
    const emptyFile: AgentsFile = { agents: {} };
    expect(() => loadAgents(emptyFile)).toThrow("No agents defined");
  });

  test("agents.yml에 에이전트가 있으면 정상 로드", () => {
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
    expect(result["researcher"]).toBeDefined();
    expect(result["researcher"].name).toBe("Researcher");
  });

  test("extends로 다른 에이전트를 상속할 수 있다", () => {
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
    expect(result["peer_reviewer"].emoji).toBe("🔬"); // inherited
    expect(result["peer_reviewer"].name).toBe("Peer Reviewer"); // overridden
  });

  test("disabled 에이전트는 결과에서 제외된다", () => {
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
    expect(agents["writer"]).toBeDefined();
    expect(agents["editor"]).toBeUndefined();
  });

  test("disabled 에이전트를 extends하면 에러를 던진다", () => {
    const custom: AgentsFile = {
      agents: {
        base: { disabled: true, name: "Base", emoji: "🔵", tools: [], systemPrompt: "Base." },
        derived: { extends: "base", name: "Derived" },
      },
    };
    expect(() => loadAgents(custom)).toThrow();
  });

  test("extends 없이 필수 필드가 빠진 커스텀 에이전트는 에러를 던진다", () => {
    const custom: AgentsFile = {
      agents: {
        "incomplete-agent": { name: "Missing fields" }, // tools, systemPrompt 누락
      },
    };
    expect(() => loadAgents(custom)).toThrow();
  });
});

describe("language setting", () => {
  test("에이전트별 language를 설정할 수 있다", () => {
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
    expect(agents["writer"].language).toBe("Korean");
    expect(agents["analyst"].language).toBeUndefined();
  });

  test("글로벌 language는 모든 에이전트에 적용된다", () => {
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
    expect(agents["writer"].language).toBe("English");
    expect(agents["analyst"].language).toBe("English");
  });

  test("에이전트별 language가 글로벌 language보다 우선한다", () => {
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
    expect(agents["writer"].language).toBe("Korean");
    expect(agents["analyst"].language).toBe("English");
  });

  test("buildSystemPromptWithMemory에 language 지시문이 포함된다", () => {
    const { buildSystemPromptWithMemory } = require("./loader");
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

  test("language가 없으면 language 지시문이 포함되지 않는다", () => {
    const { buildSystemPromptWithMemory } = require("./loader");
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
  test("커스텀 workflow가 없으면 빈 jobs 반환", () => {
    const workflow = getWorkflow({ agents: {} });
    expect(workflow.jobs).toBeDefined();
  });

  test("커스텀 workflow jobs를 오버라이드할 수 있다", () => {
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
    expect(workflow.jobs["research"]).toBeDefined();
    expect(workflow.jobs["research"].description).toBe("Research phase");
  });
});
