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

async function callChat(body) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request("https://mori-companion.pages.dev/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
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
  assert.match(html, /连接模型/);
  assert.match(html, /心理支持与资源导航/);
  assert.match(html, /只属于你的安静角落/);
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
  assert.match(page, /crossedDragThreshold/);
  assert.match(page, /if \(!dragRef\.current\.moved\)/);
  assert.match(page, /点我换表情/);
  assert.match(page, /buildLetter/);
  assert.match(page, /mori-letter-drafts/);
  assert.match(page, /保存草稿/);
  assert.match(page, /不会自动发送/);
  assert.match(page, /mori-journal-entries/);
  assert.match(page, /JOURNAL_STICKERS/);
  assert.match(page, /importJournalImages/);
  assert.match(page, /保存这一页/);
  assert.match(page, /startJournalStickerDrag/);
  assert.match(page, /removeJournalSticker/);
  assert.match(page, /打开 MORI 手账/);
  assert.match(page, /打开 MORI 树洞/);
  assert.match(page, /打开 MORI 心理花园/);
  assert.doesNotMatch(page, /树洞 <span>/);
  assert.match(page, /MORI 的树洞/);
  assert.match(page, /ACTION_LINES/);
  assert.match(page, /actionRef\.current === "sleep" \? "read"/);
  assert.match(page, /45000 \+ Math\.random\(\) \* 45000/);
  assert.match(page, /walkDirectionRef/);
  assert.match(page, /is-walking/);
  assert.match(page, /const \[action, setAction\] = useState<PetAction>\("walk"\)/);
  assert.match(page, /type PetAction = "listen" \| "walk" \| "sleep" \| "read" \| "stretch"/);
  assert.doesNotMatch(page, /label: "发呆"/);
  assert.match(page, /openBubbleChat/);
  assert.match(page, /thought-bubble-anchor/);
  assert.match(page, /和 MORI 聊聊/);
  assert.match(page, /查看全部聊天/);
  assert.match(page, /bubble-chat-messages/);
  assert.match(page, /GROW A LITTLE TODAY/);
  assert.match(page, /mori-garden-moments/);
  assert.match(page, /MORI 的彩色手账/);
  assert.match(page, /不代表健康评估/);
  assert.match(page, /国家卫生健康委/);
  assert.match(page, /worldhealth|who\.int/i);
  assert.match(route, /MORI_SYSTEM_PROMPT/);
  assert.match(route, /callOpenAI/);
  assert.match(route, /callAnthropic/);
  assert.match(route, /callGemini/);
  assert.match(route, /OpenAI|compatible/);
  assert.match(page, /验证并连接/);
  assert.match(page, /模型尚未验证，本条没有发送到模型服务/);
  assert.match(page, /未自动改用演示回复/);
  assert.match(route, /线上 MORI 无法访问你电脑上的 localhost/);
});

test("rejects a local model address from the deployed Pages runtime", async () => {
  const response = await callChat({
    provider: "compatible",
    baseUrl: "http://localhost:11434/v1",
    model: "llama3",
    messages: [{ role: "user", content: "connectivity check" }],
  });
  assert.equal(response.status, 500);
  const payload = await response.json();
  assert.match(payload.error, /线上 MORI 无法访问你电脑上的 localhost/);
});
