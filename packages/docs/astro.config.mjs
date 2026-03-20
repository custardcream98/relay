// docs-site/astro.config.mjs
import sitemap from "@astrojs/sitemap";
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
    sitemap(),
    starlight({
      expressiveCode: {
        defaultProps: { frame: "none" },
      },
      title: "relay",
      logo: {
        light: "./src/assets/logo-light.svg",
        dark: "./src/assets/logo-dark.svg",
        replacesTitle: false,
      },
      description:
        "relay is a multi-agent collaboration framework for Claude Code. Assemble any team from your agent pool — web dev, research, marketing — and agents collaborate peer-to-peer via MCP. No extra API costs.",
      social: [
        {
          icon: "github",
          label: "GitHub",
          href: "https://github.com/custardcream98/relay",
        },
      ],
      favicon: "/favicon.svg",
      // Starlight custom CSS — kept in sync with the landing page design tokens
      customCss: ["./src/styles/starlight-theme.css"],
      // OG and Twitter Card tags injected into every Starlight doc page
      head: [
        {
          tag: "meta",
          attrs: { property: "og:image", content: "https://custardcream98.github.io/relay/og.svg" },
        },
        {
          tag: "meta",
          attrs: { name: "twitter:card", content: "summary_large_image" },
        },
        {
          tag: "meta",
          attrs: {
            name: "twitter:image",
            content: "https://custardcream98.github.io/relay/og.svg",
          },
        },
        {
          tag: "meta",
          attrs: { property: "og:site_name", content: "relay" },
        },
        {
          tag: "meta",
          attrs: {
            name: "keywords",
            content:
              "Claude Code, multi-agent, AI agents, MCP, workflow automation, Claude, relay, peer-to-peer agents",
          },
        },
      ],
      defaultLocale: "root",
      locales: {
        root: { label: "English", lang: "en" },
        "ko-kr": { label: "한국어", lang: "ko-KR" },
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
              label: "agents.pool.yml schema",
              translations: { "ko-KR": "agents.pool.yml 스키마" },
              slug: "reference/agents-yml",
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
