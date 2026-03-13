// docs-site/astro.config.mjs

import starlight from "@astrojs/starlight";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

export default defineConfig({
  // GitHub Pages 배포 시 repo 이름이 base path가 됨
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
      // Starlight 커스텀 CSS — 랜딩 페이지 디자인 토큰과 일치시킴
      customCss: ["./src/styles/starlight-theme.css"],
      sidebar: [
        {
          label: "Getting Started",
          items: [
            { label: "Introduction", slug: "getting-started/introduction" },
            { label: "Installation", slug: "getting-started/installation" },
            { label: "Quick start", slug: "getting-started/quick-start" },
          ],
        },
        {
          label: "Guides",
          items: [
            { label: "/relay:init — project scan", slug: "guides/relay-init" },
            { label: "/relay:relay — full workflow", slug: "guides/relay" },
            { label: "/relay:agent — single agent", slug: "guides/relay-agent" },
            { label: "Customising agents", slug: "guides/agents" },
            { label: "Workflow config", slug: "guides/workflow" },
            { label: "Dashboard", slug: "guides/dashboard" },
          ],
        },
        {
          label: "Reference",
          items: [
            { label: "MCP tools", slug: "reference/mcp-tools" },
            { label: "agents.yml schema", slug: "reference/agents-yml" },
            { label: "Workflow schema", slug: "reference/workflow" },
            { label: "Memory structure", slug: "reference/memory" },
          ],
        },
      ],
    }),
  ],
});
