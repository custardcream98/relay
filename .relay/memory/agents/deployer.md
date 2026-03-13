
---
_2026-03-13_

## Release: relay Landing Page — 2026-03-13

- **What shipped**: relay 공식 랜딩 페이지 (packages/docs/)
- **Deployment**: GitHub Pages via deploy-docs.yml (OIDC-based, triggered on push to main)
- **Tech**: Astro + Tailwind CSS v4, custom index.astro separate from Starlight docs
- **Key sections**: Nav, Hero, HowItWorks, AgentRoster, QuickStart, Features, Footer
- **Design**: Violet accent, monochrome base, light/dark theme tokens
- **QA status**: Build passes; two issues noted by QA (AgentRoster color conflict for QA/Deployer, favicon BASE_URL hardcoding) — tracked as follow-up
- **Deploy workflow**: deploy-docs.yml reviewed and approved by BE2 reviewer (OIDC, correct permissions, concurrency settings)
- **npm release**: Not applicable (docs site only, no changeset needed)

