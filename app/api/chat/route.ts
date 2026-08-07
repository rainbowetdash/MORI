import { NextRequest, NextResponse } from "next/server";

type ChatBody = {
  apiKey?: string;
  appId?: string;
  baseUrl?: string;
  sessionId?: string;
  messages?: Array<{ role: "user" | "assistant"; content: string }>;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ChatBody;
    if (!body.apiKey || !body.appId || !body.baseUrl || !Array.isArray(body.messages)) {
      return NextResponse.json({ error: "请填写 API Key、Agent 应用 ID 和服务地址" }, { status: 400 });
    }

    const endpoint = new URL(`/api/v1/apps/${encodeURIComponent(body.appId)}/completion`, body.baseUrl);
    if (endpoint.protocol !== "https:" && endpoint.hostname !== "localhost") {
      return NextResponse.json({ error: "服务地址必须使用 HTTPS" }, { status: 400 });
    }

    const prompt = [...body.messages].reverse().find((message) => message.role === "user")?.content?.trim();
    if (!prompt) return NextResponse.json({ error: "没有可发送的用户消息" }, { status: 400 });

    const upstream = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${body.apiKey}`,
      },
      body: JSON.stringify({
        input: {
          prompt,
          ...(body.sessionId ? { session_id: body.sessionId } : {}),
        },
        parameters: {},
        debug: {},
      }),
    });

    const payload = (await upstream.json()) as {
      output?: { text?: string; session_id?: string };
      message?: string;
    };

    if (!upstream.ok) {
      return NextResponse.json({ error: payload.message || "百炼 Agent 连接失败" }, { status: upstream.status });
    }

    const reply = payload.output?.text?.trim();
    if (!reply) return NextResponse.json({ error: "百炼 Agent 没有返回内容" }, { status: 502 });
    return NextResponse.json({ reply, sessionId: payload.output?.session_id ?? "" });
  } catch {
    return NextResponse.json({ error: "请求处理失败，请检查服务地址、Agent 应用 ID 与网络" }, { status: 500 });
  }
}
