// docs-site/astro.config.mjs

import starlight from "@astrojs/starlight";
import { defineConfig } from "astro/config";

export default defineConfig({
  // GitHub Pages 배포 시 repo 이름이 base path가 됨
  site: "https://custardcream98.github.io",
  base: "/relay",
  integrations: [
    starlight({
      title: "relay",
      description: "Claude Code 위에서 동작하는 멀티 에이전트 협업 프레임워크",
      social: [
        {
          icon: "github",
          label: "GitHub",
          href: "https://github.com/custardcream98/relay",
        },
      ],
      sidebar: [
        {
          label: "시작하기",
          items: [
            { label: "소개", slug: "getting-started/introduction" },
            { label: "설치", slug: "getting-started/installation" },
            { label: "빠른 시작", slug: "getting-started/quick-start" },
          ],
        },
        {
          label: "가이드",
          items: [
            { label: "/relay-init — 프로젝트 파악", slug: "guides/relay-init" },
            { label: "/relay — 전체 워크플로", slug: "guides/relay" },
            { label: "/relay-agent — 단일 에이전트", slug: "guides/relay-agent" },
            { label: "에이전트 커스터마이즈", slug: "guides/agents" },
            { label: "워크플로 설정", slug: "guides/workflow" },
            { label: "대시보드", slug: "guides/dashboard" },
          ],
        },
        {
          label: "레퍼런스",
          items: [
            { label: "MCP 툴", slug: "reference/mcp-tools" },
            { label: "agents.yml 스키마", slug: "reference/agents-yml" },
            { label: "워크플로 스키마", slug: "reference/workflow" },
            { label: "메모리 구조", slug: "reference/memory" },
          ],
        },
      ],
    }),
  ],
});
