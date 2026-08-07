import { cp, mkdir, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";

const projectDir = new URL("../", import.meta.url);
const releaseDir = await mkdtemp(join(tmpdir(), "mori-pages-release-"));
const releaseConfigDir = join(releaseDir, "cloudflare-pages");

await mkdir(join(releaseDir, "dist"), { recursive: true });
await mkdir(releaseConfigDir, { recursive: true });
await cp(new URL("../dist/pages/", import.meta.url), join(releaseDir, "dist/pages"), { recursive: true });
await cp(
  new URL("../cloudflare-pages/wrangler.jsonc", import.meta.url),
  join(releaseConfigDir, "wrangler.jsonc"),
);

const wrangler = join(projectDir.pathname, "node_modules/.bin/wrangler");
const child = spawn(
  wrangler,
  ["--cwd", releaseConfigDir, "pages", "deploy", "--branch", "main"],
  { stdio: "inherit" },
);

child.on("exit", (code) => process.exit(code ?? 1));
