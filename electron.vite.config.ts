import { defineConfig } from "electron-vite";
import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  main: {
    build: {
      rollupOptions: {
        input: resolve(
          __dirname,
          "apps/desktop/src/main/index.ts"
        ),

        external: [
          "electron",
          "better-sqlite3",
        ],
      },

      commonjsOptions: {
        ignoreDynamicRequires: true,

        dynamicRequireTargets: [
          resolve(
            __dirname,
            "node_modules/better-sqlite3/**/*"
          ),
        ],
      },
    },
  },

  preload: {
    build: {
      rollupOptions: {
        input: resolve(
          __dirname,
          "apps/desktop/src/preload/index.ts"
        ),

        external: ["electron"],

        output: {
          format: "cjs",
          entryFileNames: "[name].cjs",
        },
      },
    },
  },

  renderer: {
    root: resolve(
      __dirname,
      "apps/renderer"
    ),

    plugins: [
      react(),
      tailwindcss(),
    ],

    resolve: {
      alias: {
        "@": resolve(
          __dirname,
          "apps/renderer/src"
        ),
      },
    },

    build: {
      rollupOptions: {
        input: resolve(
          __dirname,
          "apps/renderer/index.html"
        ),
      },
    },
  },
});