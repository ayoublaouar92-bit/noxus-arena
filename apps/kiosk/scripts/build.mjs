import esbuild from "esbuild";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const root = path.join(__dirname, "..");
const dist = path.join(root, "dist");
const src = path.join(root, "src");

fs.mkdirSync(dist, { recursive: true });

await esbuild.build({
  entryPoints: [path.join(src, "main.ts")],
  bundle: true,
  platform: "node",
  target: "node20",
  outfile: path.join(dist, "main.js"),

  // IMPORTANT: keep Electron imports as runtime externals
  // so esbuild doesn't bundle the npm "electron" package.
  external: ["electron"],
});

await esbuild.build({
  entryPoints: [path.join(src, "preload.ts")],
  bundle: true,
  platform: "node",
  target: "node20",
  outfile: path.join(dist, "preload.js"),

  // IMPORTANT: keep Electron imports as runtime externals
  external: ["electron"],
});

// Copy UI and the shared Login background used by Kiosk.
fs.copyFileSync(path.join(src, "ui.html"), path.join(dist, "ui.html"));
fs.copyFileSync(path.join(src, "noxus-arena-emblem.jpeg"), path.join(dist, "noxus-arena-emblem.jpeg"));

// Copy default config
fs.copyFileSync(path.join(root, "config.json"), path.join(dist, "config.json"));

console.log("Built kiosk to dist/");