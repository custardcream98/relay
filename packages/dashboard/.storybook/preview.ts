import type { Preview } from "@storybook/react";
import "../src/index.css";

const preview: Preview = {
  parameters: {
    backgrounds: {
      default: "dark",
      values: [
        { name: "dark", value: "#0f0d0a" },
        { name: "light", value: "#f5f0e8" },
      ],
    },
    layout: "padded",
  },
};

export default preview;
