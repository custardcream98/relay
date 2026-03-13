// docs-site/astro.config.mjs

import starlight from "@astrojs/starlight";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

export default defineConfig({
  // When deployed to GitHub Pages, the repo name becomes the base path
  site: "https://custardcream98.github.io",
  base: "/relay",
  vite: {
    plugins: [tailwindcss()],
  },
  integrations: [
    starlight({
      title: "relay",
      description: "Multi-agent framework for Claude Code",
      social: [
        {
          icon: "github",
          label: "GitHub",
          href: "https://github.com/custardcream98/relay",
        },
      ],
      // Starlight custom CSS — kept in sync with the landing page design tokens
      customCss: ["./src/styles/starlight-theme.css"],
      defaultLocale: "root",
      locales: {
        root: { label: "English", lang: "en" },
        "ko-KR": { label: "한국어", lang: "ko-KR" },
      },
      sidebar: [
        {
          label: "Getting Started",
          translations: { "ko-KR": "시작하기" },
          items: [
            {
              label: "Introduction",
              translations: { "ko-KR": "소개" },
              slug: "getting-started/introduction",
            },
            {
              label: "Installation",
              translations: { "ko-KR": "설치" },
              slug: "getting-started/installation",
            },
            {
              label: "Quick start",
              translations: { "ko-KR": "빠른 시작" },
              slug: "getting-started/quick-start",
            },
          ],
        },
        {
          label: "Guides",
          translations: { "ko-KR": "가이드" },
          items: [
            {
              label: "/relay:init — project scan",
              translations: { "ko-KR": "/relay:init — 프로젝트 파악" },
              slug: "guides/relay-init",
            },
            {
              label: "/relay:relay — full workflow",
              translations: { "ko-KR": "/relay:relay — 전체 워크플로" },
              slug: "guides/relay",
            },
            {
              label: "/relay:agent — single agent",
              translations: { "ko-KR": "/relay:agent — 단일 에이전트" },
              slug: "guides/relay-agent",
            },
            {
              label: "Customising agents",
              translations: { "ko-KR": "에이전트 커스터마이즈" },
              slug: "guides/agents",
            },
            {
              label: "Workflow config",
              translations: { "ko-KR": "워크플로 설정" },
              slug: "guides/workflow",
            },
            {
              label: "Dashboard",
              translations: { "ko-KR": "대시보드" },
              slug: "guides/dashboard",
            },
          ],
        },
        {
          label: "Reference",
          translations: { "ko-KR": "레퍼런스" },
          items: [
            {
              label: "MCP tools",
              translations: { "ko-KR": "MCP 툴 레퍼런스" },
              slug: "reference/mcp-tools",
            },
            {
              label: "agents.yml schema",
              translations: { "ko-KR": "agents.yml 스키마" },
              slug: "reference/agents-yml",
            },
            {
              label: "Workflow schema",
              translations: { "ko-KR": "워크플로 스키마" },
              slug: "reference/workflow",
            },
            {
              label: "Memory structure",
              translations: { "ko-KR": "메모리 구조" },
              slug: "reference/memory",
            },
          ],
        },
      ],
    }),
  ],
});
