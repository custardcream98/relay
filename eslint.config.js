import js from "@eslint/js";
import prettierConfig from "eslint-config-prettier";
import perfectionist from "eslint-plugin-perfectionist";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/node_modules",
      "**/dist",
      "**/storybook-static",
      "packages/docs/.astro",
      ".relay",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      eqeqeq: ["error", "always", { null: "ignore" }],
      "no-self-compare": "error",
      "no-constructor-return": "error",
      "@typescript-eslint/no-useless-constructor": "error",
      "no-useless-rename": "error",
      "no-sequences": "error",
      "prefer-template": "warn",
    },
  },
  {
    plugins: { perfectionist },
    rules: {
      "perfectionist/sort-imports": [
        "error",
        {
          type: "natural",
          order: "asc",
          newlinesBetween: 1,
          groups: [
            "type-import",
            "value-builtin",
            ["value-external", "type-external"],
            ["value-internal", "type-internal"],
            [
              "value-parent",
              "type-parent",
              "value-sibling",
              "type-sibling",
              "value-index",
              "type-index",
            ],
          ],
          environment: "node",
        },
      ],
    },
  },
  {
    files: ["packages/dashboard/**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks, "react-refresh": reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
    },
  },
  {
    files: ["scripts/**/*.js"],
    languageOptions: {
      globals: {
        console: "readonly",
        process: "readonly",
      },
    },
  },
  prettierConfig
);
