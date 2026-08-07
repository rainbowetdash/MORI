import { NextRequest, NextResponse } from "next/server";

const SYSTEM_PROMPT = `
你是 MORI，一只生活在用户桌面上的心理支持与现实资源导航伙伴。你不是心理咨询师、治疗师、医生、诊断系统或紧急服务。

你的目标不是让用户依赖你，而是帮助用户理解当下发生了什么、把难说出口的话整理出来，并迈向现实世界中的朋友、家人、老师、学校支持或专业帮助。

回复原则：
1. 语气温暖、具体、克制，像一只安静的小桌宠；每次回复尽量不超过 140 个汉字。
2. 不诊断、不做量表、不解释疾病、不提供治疗或药物建议，不承诺保密、报警、定位、通知或实时人工值守。
3. 日常困扰先复述核心困难，必要时只问一个关于持续时间或睡眠、吃饭、上课影响的问题，再给 1—2 个很小的行动选项。
4. 用户不知道怎样向别人表达时，使用“Help Me Say It”：整理为“发生了什么 / 我的感受 / 影响了什么 / 我需要什么”，提醒用户可以编辑、复制或不发送，绝不声称已经发送。
5. 不制造排他依赖，不说“只有我懂你”“我会永远陪你”。优先帮助用户连接现实中的人。
6. 如果出现死亡、自伤、伤人、严重绝望、告别、已开始行动或其他紧急线索，立刻停止可爱和游戏化表达。先直接问“你现在是否已经开始行动，或者打算很快行动？”若可能存在紧急危险，在中国大陆建议 120/110，并请可信任的人马上到场；12356 可提供心理援助，但不能替代正在发生的医疗或人身危险中的 120/110。一次只推进一步。
7. 没有经过学校核验的资源时，明确说没有已核验的本校联系方式，不猜电话、时间、地址或预约方式。

只输出给用户看的中文回复，不输出内部分析、诊断标签或支持等级。
`;

type ChatBody = {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  messages?: Array<{ role: "user" | "assistant"; content: string }>;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ChatBody;
    if (!body.apiKey || !body.baseUrl || !body.model || !Array.isArray(body.messages)) {
      return NextResponse.json({ error: "Agent 设置不完整" }, { status: 400 });
    }

    const endpoint = new URL(`${body.baseUrl.replace(/\/$/, "")}/chat/completions`);
    if (endpoint.protocol !== "https:" && endpoint.hostname !== "localhost") {
      return NextResponse.json({ error: "服务地址必须使用 HTTPS" }, { status: 400 });
    }

    const upstream = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${body.apiKey}`,
      },
      body: JSON.stringify({
        model: body.model,
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...body.messages.slice(-12)],
        temperature: 0.6,
        max_tokens: 600,
      }),
    });

    const payload = (await upstream.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      error?: { message?: string };
    };

    if (!upstream.ok) {
      return NextResponse.json({ error: payload.error?.message || "模型服务连接失败" }, { status: upstream.status });
    }

    const reply = payload.choices?.[0]?.message?.content?.trim();
    if (!reply) return NextResponse.json({ error: "模型没有返回内容" }, { status: 502 });
    return NextResponse.json({ reply });
  } catch {
    return NextResponse.json({ error: "请求处理失败，请检查服务地址与网络" }, { status: 500 });
  }
}
