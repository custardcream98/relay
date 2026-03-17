import type { Meta, StoryObj } from "@storybook/react";
import { ArtifactDetailModal } from "./ArtifactDetailModal";

// Mock fetch globally for this story file
const MOCK_ARTIFACT = {
  id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  name: "login-design-spec",
  type: "figma_spec",
  content: [
    "# Login Page Design Spec",
    "",
    "## Screens",
    "1. **Login form** — email + password fields, submit button, forgot password link",
    "2. **Loading state** — spinner overlay on submit",
    "3. **Error state** — inline validation, toast for server errors",
    "",
    "## Components",
    "- `LoginForm` — controlled form with Zod validation",
    "- `PasswordInput` — toggleable visibility, strength indicator",
    "- `SocialLoginButtons` — Google, GitHub OAuth",
    "",
    "## Interaction",
    "- Tab order: email -> password -> remember me -> submit",
    "- Enter key submits form from any field",
    "- Auto-focus email field on mount",
    "",
    "## Edge Cases",
    "- Empty state: all fields blank, submit disabled",
    "- Rate limit: show countdown timer after 5 failed attempts",
    "- Session expired: redirect to login with flash message",
  ].join("\n"),
  created_by: "designer",
  task_id: null,
  created_at: Math.floor(Date.now() / 1000) - 300,
};

function mockFetchDecorator(artifact: typeof MOCK_ARTIFACT, delay = 200) {
  return (Story: React.ComponentType) => {
    const origFetch = window.fetch;
    window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/api/artifacts/")) {
        return new Promise((resolve) =>
          setTimeout(
            () =>
              resolve(
                new Response(JSON.stringify({ success: true, artifact }), {
                  headers: { "Content-Type": "application/json" },
                })
              ),
            delay
          )
        );
      }
      return origFetch(input, init);
    };
    return <Story />;
  };
}

const meta = {
  component: ArtifactDetailModal,
  parameters: { layout: "centered" },
  args: {
    artifactId: MOCK_ARTIFACT.id,
    serverUrl: "",
    onClose: () => {},
    anchorRect: null,
  },
  decorators: [mockFetchDecorator(MOCK_ARTIFACT)],
} satisfies Meta<typeof ArtifactDetailModal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const LongContent: Story = {
  decorators: [
    mockFetchDecorator({
      ...MOCK_ARTIFACT,
      name: "auth-api-implementation",
      type: "pr",
      created_by: "be",
      content: [
        "# Auth API Implementation",
        "",
        "## Summary",
        "Implemented JWT-based authentication with refresh token rotation.",
        "",
        "## Changed Files",
        "- `src/auth/jwt.ts` — Token signing/verification with RS256",
        "- `src/auth/refresh.ts` — Refresh token rotation with jti tracking",
        "- `src/auth/middleware.ts` — Express middleware for route protection",
        "- `src/auth/routes.ts` — POST /login, POST /refresh, POST /logout",
        "- `src/db/migrations/003_sessions.ts` — Session table for revocation",
        "",
        "## Key Decisions",
        "1. **RS256 over HS256** — allows public key distribution for service-to-service auth",
        "2. **Refresh token rotation** — each refresh invalidates the previous token (prevents replay)",
        "3. **httpOnly cookie** — refresh token stored as httpOnly, SameSite=Strict cookie",
        "4. **Rate limiting** — 5 login attempts per IP per minute (express-rate-limit)",
        "",
        "## API Spec",
        "",
        "### POST /api/auth/login",
        "```json",
        '{ "email": "user@example.com", "password": "..." }',
        "```",
        "**Response 200:**",
        "```json",
        '{ "access_token": "eyJ...", "expires_in": 900 }',
        "```",
        "Set-Cookie: `refresh_token=...; HttpOnly; SameSite=Strict; Path=/api/auth`",
        "",
        "### POST /api/auth/refresh",
        "No body needed — reads refresh_token from cookie.",
        "**Response 200:** same as login",
        "",
        "### POST /api/auth/logout",
        "Revokes session, clears cookie.",
        "**Response 204:** No content",
        "",
        "## Testing Instructions",
        "1. `bun test src/auth/` — 24 unit tests",
        "2. Manual: POST /api/auth/login with valid creds, verify JWT in response",
        "3. Manual: Use refresh endpoint, verify old refresh token is invalidated",
      ].join("\n"),
    }),
  ],
};

export const NotFound: Story = {
  decorators: [
    (Story: React.ComponentType) => {
      const origFetch = window.fetch;
      window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input.toString();
        if (url.includes("/api/artifacts/")) {
          return Promise.resolve(
            new Response(JSON.stringify({ success: false, error: "Artifact not found" }), {
              status: 404,
              headers: { "Content-Type": "application/json" },
            })
          );
        }
        return origFetch(input, init);
      };
      return <Story />;
    },
  ],
};

export const Loading: Story = {
  decorators: [mockFetchDecorator(MOCK_ARTIFACT, 999999)],
};
