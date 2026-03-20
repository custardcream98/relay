import { resolve } from "node:path";

import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  outDir: "dist",
  format: "esm",
  platform: "node",
  target: "node18",
  bundle: true,
  clean: true,
  minify: false,
  sourcemap: false,
  splitting: false,
  shims: true, // Injects createRequire for CJS interop
  noExternal: [/.*/], // Inline all dependencies — no node_modules at runtime
  banner: {
    js: "#!/usr/bin/env node",
  },
  esbuildOptions(options) {
    options.alias = {
      "relay-shared": resolve(__dirname, "../shared/index.ts"),
    };
    // Provide real require() for CJS deps (ws) bundled into ESM
    options.banner = {
      js: [
        options.banner?.js ?? "",
        'import { createRequire as __createRequire } from "node:module"; const require = __createRequire(import.meta.url);',
      ]
        .filter(Boolean)
        .join("\n"),
    };
  },
});
