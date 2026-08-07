import { cp, rm } from "node:fs/promises";
import { build } from "esbuild";

const clientDir = new URL("../dist/client/", import.meta.url);
const serverDir = new URL("../dist/server/", import.meta.url);
const pagesDir = new URL("../dist/pages/", import.meta.url);

await rm(pagesDir, { force: true, recursive: true });
await cp(clientDir, pagesDir, { recursive: true });

// Pages advanced mode recognizes this entry name and bundles its imported
// server modules while still exposing the project's static ASSETS binding.
await build({
  bundle: true,
  conditions: ["workerd", "worker", "browser"],
  entryPoints: [new URL("index.js", serverDir).pathname],
  external: ["node:*"],
  format: "esm",
  minify: true,
  outfile: new URL("_worker.js", pagesDir).pathname,
  platform: "neutral",
  target: "es2022",
});
