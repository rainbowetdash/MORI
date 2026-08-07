import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render(path = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request(`http://localhost${path}`, { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the MORI experience", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /MORI/);
  assert.match(html, /和 MORI 聊聊/);
  assert.match(html, /连接 Agent/);
  assert.match(html, /心理支持与资源导航/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/);
});

test("keeps safety and user control in the product source", async () => {
  const [page, route] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/chat/route.ts", import.meta.url), "utf8"),
  ]);
  assert.match(page, /高风险|HIGH_URGENCY_PATTERN/);
  assert.match(page, /自动发送/);
  assert.match(page, /120/);
  assert.match(page, /110/);
  assert.match(page, /12356/);
  assert.match(page, /黄赌毒/);
  assert.match(page, /未成年/);
  assert.match(page, /MOODS/);
  assert.match(page, /isDragging/);
  assert.match(page, /stageRef/);
  assert.match(page, /dockClearance/);
  assert.match(page, /点我换表情/);
  assert.match(page, /buildLetter/);
  assert.match(page, /mori-letter-drafts/);
  assert.match(page, /保存草稿/);
  assert.match(page, /不会自动发送/);
  assert.match(page, /mori-support-kit/);
  assert.match(page, /mori-garden-moments/);
  assert.match(page, /现实中的支持/);
  assert.match(page, /不代表健康评估/);
  assert.match(page, /国家卫生健康委/);
  assert.match(page, /worldhealth|who\.int/i);
  assert.match(route, /\/api\/v1\/apps/);
  assert.match(route, /appId/);
  assert.match(route, /session_id/);
  assert.match(route, /payload\.output\?\.text/);
});
