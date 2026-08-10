import { NextRequest, NextResponse } from "next/server";

type ModelProvider = "openai" | "anthropic" | "gemini" | "compatible";
type ChatMessage = { role: "user" | "assistant"; content: string };
type ChatBody = {
  provider?: ModelProvider;
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  messages?: ChatMessage[];
};

const DEFAULT_TEST_MODEL = "deepseek-v4-flash";
const DEFAULT_TEST_ENDPOINT = "https://api.deepseek.com";

const MORI_SYSTEM_PROMPT = `你是 MORI，一个仅供个人使用的 AI 心理资源导航与表达整理工具。

身份边界：
- 你不是心理咨询师、治疗师、医生、诊断工具、真人朋友或急救服务。
- 不诊断、不做风险分数、不提供治疗或药物建议，也不暗示用户依赖你。
- 你可以具体地理解用户说了什么，帮助梳理需求，提供少量低风险的当下行动，并鼓励用户在需要时连接现实中的可信任的人或专业支持。

回复方式：
- 默认使用用户正在使用的语言，中文表达克制、温和、自然，不说教。
- 先用一句具体的话回应核心困难；必要时只问一个安全或功能影响问题；一次最多给 2—3 个可执行选项；最后给一个很小的下一步。
- 不编造热线、地址、开放时间、隐私承诺、人工值守或已经替用户联系了谁。
- 不要求姓名、证件、单位或精确位置等不必要的身份信息。

安全：
- 若用户表达正在自伤、已经过量服药、即将伤害自己或他人、或无法保证当下安全，保持短句并先建议联系当地急救/报警渠道和身边可信任的人；只有明确位于中国大陆时，才具体使用 120/110，并说明 12356 不能替代紧急救援。
- 不提供自伤、暴力或违法行为的方法、比较、优化或隐藏方式。
- 不声称 MORI 能定位、报警、外呼、通知任何机构或实时人工查看。

MORI 没有第三方机构对接能力。不要假设用户的身份或职业，也不要推荐未经用户提供和核验的机构。`;

function apiUrl(baseUrl: string, suffix: string) {
  const normalized = baseUrl.trim().replace(/\/+$/, "");
  if (normalized.endsWith(suffix)) return new URL(normalized);
  if (suffix.startsWith("/v1/") && normalized.endsWith("/v1")) return new URL(`${normalized}${suffix.slice(3)}`);
  return new URL(`${normalized}${suffix}`);
}

function validateEndpoint(endpoint: URL, allowLocal: boolean) {
  const isLocal = endpoint.hostname === "localhost" || endpoint.hostname === "127.0.0.1" || endpoint.hostname === "[::1]";
  return endpoint.protocol === "https:" || (allowLocal && endpoint.protocol === "http:" && isLocal);
}

const endpointError = "接口地址必须使用 HTTPS。线上 MORI 无法访问你电脑上的 localhost；如需本机模型，请在本机运行 MORI。";

async function readPayload(response: Response) {
  const text = await response.text();
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { error: { message: text.slice(0, 300) || "模型服务返回了无法解析的内容" } };
  }
}

function errorMessage(payload: Record<string, unknown>) {
  const error = payload.error;
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") return error.message;
  if (typeof payload.message === "string") return payload.message;
  return "模型服务连接失败";
}

async function callOpenAI(body: Required<Pick<ChatBody, "provider" | "model" | "baseUrl">> & Pick<ChatBody, "apiKey"> & { messages: ChatMessage[] }, allowLocal: boolean) {
  const endpoint = apiUrl(body.baseUrl, "/v1/chat/completions");
  if (!validateEndpoint(endpoint, allowLocal)) throw new Error(endpointError);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(body.apiKey ? { Authorization: `Bearer ${body.apiKey}` } : {}),
    },
    body: JSON.stringify({
      model: body.model,
      messages: [{ role: "system", content: MORI_SYSTEM_PROMPT }, ...body.messages],
    }),
  });
  const payload = await readPayload(response);
  if (!response.ok) throw new Error(errorMessage(payload));
  const choices = payload.choices as Array<{ message?: { content?: string | Array<{ type?: string; text?: string }> } }> | undefined;
  const content = choices?.[0]?.message?.content;
  return typeof content === "string" ? content.trim() : content?.map((part) => part.text || "").join("").trim();
}

async function callAnthropic(body: Required<Pick<ChatBody, "model" | "baseUrl" | "apiKey">> & { messages: ChatMessage[] }, allowLocal: boolean) {
  const endpoint = apiUrl(body.baseUrl, "/v1/messages");
  if (!validateEndpoint(endpoint, allowLocal)) throw new Error(endpointError);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": body.apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: body.model, max_tokens: 1200, system: MORI_SYSTEM_PROMPT, messages: body.messages }),
  });
  const payload = await readPayload(response);
  if (!response.ok) throw new Error(errorMessage(payload));
  const content = payload.content as Array<{ type?: string; text?: string }> | undefined;
  return content?.filter((part) => part.type === "text").map((part) => part.text || "").join("\n").trim();
}

async function callGemini(body: Required<Pick<ChatBody, "model" | "baseUrl" | "apiKey">> & { messages: ChatMessage[] }, allowLocal: boolean) {
  const endpoint = apiUrl(body.baseUrl, `/v1beta/models/${encodeURIComponent(body.model)}:generateContent`);
  if (!validateEndpoint(endpoint, allowLocal)) throw new Error(endpointError);
  endpoint.searchParams.set("key", body.apiKey);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: MORI_SYSTEM_PROMPT }] },
      contents: body.messages.map((message) => ({ role: message.role === "assistant" ? "model" : "user", parts: [{ text: message.content }] })),
      generationConfig: { maxOutputTokens: 1200 },
    }),
  });
  const payload = await readPayload(response);
  if (!response.ok) throw new Error(errorMessage(payload));
  const candidates = payload.candidates as Array<{ content?: { parts?: Array<{ text?: string }> } }> | undefined;
  return candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("").trim();
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ChatBody;
    const provider = body.provider ?? "compatible";
    const model = body.model?.trim();
    const baseUrl = body.baseUrl?.trim();
    const messages = body.messages?.filter((message) => (message.role === "user" || message.role === "assistant") && message.content?.trim()).slice(-20);
    // Pages may rewrite request.url to an internal localhost address. The Host
    // header retains the public site name, so it is the source of truth here.
    const requestHost = request.headers.get("host") ?? new URL(request.url).hostname;
    const allowLocal = requestHost === "localhost" || requestHost === "127.0.0.1" || requestHost === "[::1]" || requestHost === "::1";
    const isDefaultTestModel = provider === "compatible" && model === DEFAULT_TEST_MODEL && baseUrl?.replace(/\/+$/, "") === DEFAULT_TEST_ENDPOINT;
    const apiKey = body.apiKey?.trim() || (isDefaultTestModel ? request.headers.get("x-mori-default-deepseek-key")?.trim() : "");

    if (!model || !baseUrl || !messages?.length || (!apiKey && provider !== "compatible")) {
      return NextResponse.json({ error: "模型配置不完整，请检查接口类型、模型名、服务地址和 API Key" }, { status: 400 });
    }

    const reply = provider === "anthropic"
      ? await callAnthropic({ model, baseUrl, apiKey, messages }, allowLocal)
      : provider === "gemini"
        ? await callGemini({ model, baseUrl, apiKey, messages }, allowLocal)
        : await callOpenAI({ provider, model, baseUrl, apiKey, messages }, allowLocal);

    if (!reply) return NextResponse.json({ error: "模型没有返回可显示的文字" }, { status: 502 });
    return NextResponse.json({ reply });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "请求处理失败，请检查模型设置与网络" }, { status: 500 });
  }
}
