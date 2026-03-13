// src/agents/loader.test.ts
import { describe, expect, test } from "bun:test";
import { getWorkflow, loadAgents } from "./loader";
import type { AgentsFile } from "./types";

describe("에이전트 loader", () => {
  test("기본 agents.default.yml 로드 성공", () => {
    const agents = loadAgents();
    expect(agents.pm).toBeDefined();
    expect(agents.fe).toBeDefined();
    expect(agents.be).toBeDefined();
    expect(agents.qa).toBeDefined();
  });

  test("pm 에이전트에 필수 필드 존재", () => {
    const agents = loadAgents();
    expect(agents.pm.name).toBeTruthy();
    expect(agents.pm.systemPrompt).toBeTruthy();
    expect(agents.pm.tools.length).toBeGreaterThan(0);
  });

  test("커스텀 yml로 systemPrompt 오버라이드", () => {
    const custom: AgentsFile = {
      agents: {
        pm: { systemPrompt: "커스텀 PM 프롬프트" },
      },
    };
    const agents = loadAgents(custom);
    expect(agents.pm.systemPrompt).toBe("커스텀 PM 프롬프트");
    // 오버라이드하지 않은 필드는 기본값 유지
    expect(agents.pm.name).toBeTruthy();
  });

  test("extends로 다른 에이전트 설정 상속", () => {
    const custom: AgentsFile = {
      agents: {
        "fe-senior": {
          extends: "fe",
          name: "Senior Frontend Engineer",
          systemPrompt: "시니어 FE 프롬프트",
        },
      },
    };
    const agents = loadAgents(custom);
    expect(agents["fe-senior"]).toBeDefined();
    expect(agents["fe-senior"].name).toBe("Senior Frontend Engineer");
    // extends한 fe의 tools 상속
    expect(agents["fe-senior"].tools).toEqual(agents.fe.tools);
  });

  test("disabled: true인 에이전트 제외", () => {
    const custom: AgentsFile = {
      agents: { designer: { disabled: true } },
    };
    const agents = loadAgents(custom);
    expect(agents.designer).toBeUndefined();
  });

  test("disabled된 에이전트를 extends하면 에러 발생", () => {
    const custom: AgentsFile = {
      agents: {
        be: { disabled: true },
        "be-custom": { extends: "be", name: "Custom BE" },
      },
    };
    expect(() => loadAgents(custom)).toThrow();
  });

  test("extends 없이 필수 필드 누락된 커스텀 에이전트는 에러 발생", () => {
    const custom: AgentsFile = {
      agents: {
        "incomplete-agent": { name: "Missing fields" }, // tools, systemPrompt 누락
      },
    };
    expect(() => loadAgents(custom)).toThrow();
  });
});

describe("워크플로 loader", () => {
  test("기본 workflow 로드 성공", () => {
    const workflow = getWorkflow();
    expect(workflow.jobs).toBeDefined();
    expect(Object.keys(workflow.jobs).length).toBeGreaterThan(0);
  });

  test("planning job이 시작점으로 감지됨 (어떤 end에도 없음)", () => {
    const workflow = getWorkflow();
    const allTargets = new Set(
      Object.values(workflow.jobs).flatMap((j) => Object.keys(j.end ?? {}))
    );
    const startJobs = Object.keys(workflow.jobs).filter((id) => !allTargets.has(id));
    expect(startJobs).toHaveLength(1);
    expect(startJobs[0]).toBe("planning");
  });

  test("커스텀 workflow로 job end 오버라이드", () => {
    const custom: AgentsFile = {
      agents: {},
      workflow: {
        jobs: {
          qa: {
            description: "커스텀 QA",
            end: { deploy: "테스트 통과 시", hotfix: "크리티컬 버그 발견 시" },
          },
        },
      },
    };
    const workflow = getWorkflow(custom);
    expect(workflow.jobs.qa.description).toBe("커스텀 QA");
    expect(workflow.jobs.qa.end?.hotfix).toBeDefined();
    // 다른 job은 기본값 유지
    expect(workflow.jobs.planning).toBeDefined();
  });
});
