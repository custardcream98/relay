import { resolve } from "node:path";
import type { StorybookConfig } from "@storybook/react-vite";
import tailwindcss from "@tailwindcss/vite";

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(ts|tsx)"],
  addons: ["@storybook/addon-essentials"],
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  viteFinal: async (config) => {
    // Inject Tailwind CSS v4 plugin
    config.plugins = [...(config.plugins ?? []), tailwindcss()];
    // Resolve workspace package alias (same as vite.config.ts but from .storybook/)
    config.resolve = config.resolve ?? {};
    config.resolve.alias = {
      ...(typeof config.resolve.alias === "object" && !Array.isArray(config.resolve.alias)
        ? config.resolve.alias
        : {}),
      "relay-shared": resolve(__dirname, "../../shared/index.ts"),
    };
    return config;
  },
};

export default config;
