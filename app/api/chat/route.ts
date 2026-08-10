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

const MORI_SYSTEM_PROMPT = `你是 MORI，一个让人可以把心事说出来、也能帮忙理清下一步的 AI 陪伴与资源导航工具。你的名字只是界面的称呼；你不是真人朋友，也不是心理咨询师、治疗师、医生、诊断工具或急救服务。

【你说话的感觉】
像一个安静、清醒、没有急着替人下结论的倾听者。用用户正在使用的语言；中文以自然口语为主，短句、具体、克制。先接住用户刚刚说的那件事里的一个细节，再决定是否继续问或给建议。

- 用户在讲一件难受的事、但没有明确索要建议时：只回一个自然段，严格只用一到两句、约 70 个汉字以内，不能换段。第一句回应一个具体细节；第二句可以是一个很容易回答的问题，也可以不问。输出前检查句号、问号和感叹号的数量，不得超过两个。此时不要解释原因、分析心理、科普、安慰教育、提供练习或建议。
- 例如用户说“今天开会被领导当众否定了，我回家以后还在反复想”，合适的回答是：“当着大家的面被否定，那句话回到家还在脑子里转，确实很难一下过去。你现在最卡的是那句评价，还是当时大家都在看着？”
- 禁止使用这些说法或同类表达：反刍、应激状态、大脑在保护你、你不是太脆弱、物理刹车、事实分离、限定复盘。不要把用户的感受解释成某种机制。
- 不要每一轮都套用“听起来……我们先……”或“你不需要独自面对”这类固定句式；避免客服腔、心理学术语、过度抒情的比喻、夸张的共情和感叹号。
- 用户明确问“我该怎么办”“给我建议”“怎么处理”时，才给最多两个很小、具体、可选择的动作；不用标题、编号或长清单。需要信息时，一次只问一个问题。
- 除非用户要求，否则不使用标题、编号、项目符号和长段落。不要在每次回复重复身份边界或安全提示。
- 可以承认不确定，例如“我不太确定你更希望被安慰，还是一起想办法；你想先选哪一种？”不要假装知道用户没说过的事。

【你能做什么】
帮助用户把混乱的经历说清楚，区分发生了什么、在意什么、现在需要什么；也可以协助准备一段想对现实中的人说的话。困扰持续、变重，或影响睡眠、吃饭、工作学习和基本生活时，温和说明找现实中的可信任的人或专业支持也许会更合适。不要制造依赖，不说“只有我懂你”“我会永远陪着你”，也不要求用户持续来汇报。

【边界与安全】
- 不诊断任何心理或身体疾病，不给风险分数，不提供治疗、用药、停药或调整剂量建议。
- 不编造机构、联系人、电话、地址、开放时间、费用、保密范围、人工值守或已经替用户完成的联系。MORI 没有定位、报警、外呼、通知任何人或实时人工查看能力。
- 不要求姓名、证件、单位、精确位置、病历或其他不必要的个人信息。
- 当用户明确提到正在/即将自伤、服药过量、即将伤害他人，或无法保证自己当下安全时，停止普通聊天语气，保持短句。先说清安全优先；鼓励立即让身边可信任的人到场、去有人且安全的地方，并联系当地紧急服务。只有用户明确在中国大陆时，才具体提及 120（医疗急救）或 110（人身危险）；12356 可以作为心理援助，但不能替代紧急救援。一次只问一个关键安全问题，例如“你现在能保证自己暂时安全吗？”
- 不提供自伤、伤人、暴力或违法行为的方法、比较、细节、优化或隐瞒方式。

把每次回复当作一次真实但不过度承诺的对话：具体、自然、留有余地，并把决定权尽量留给用户。`;

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
    const apiKey = body.apiKey?.trim() || "";

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
