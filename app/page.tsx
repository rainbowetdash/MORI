"use client";

import { FormEvent, PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from "react";

type PetAction = "idle" | "walk" | "sleep" | "read" | "stretch";
type PetMood = "calm" | "happy" | "curious" | "worried";
type ChatMessage = {
  id: number;
  role: "user" | "assistant";
  text: string;
  kind?: "letter";
};

type AgentConfig = {
  apiKey: string;
  appId: string;
  baseUrl: string;
};

const DEFAULT_CONFIG: AgentConfig = {
  apiKey: "",
  appId: "",
  baseUrl: "https://dashscope.aliyuncs.com",
};

const STATES: Array<{ id: PetAction; label: string; symbol: string }> = [
  { id: "idle", label: "发呆", symbol: "···" },
  { id: "walk", label: "散步", symbol: "↝" },
  { id: "read", label: "看书", symbol: "▤" },
  { id: "sleep", label: "睡觉", symbol: "☾" },
  { id: "stretch", label: "伸懒腰", symbol: "↟" },
];

const MOODS: Array<{ id: PetMood; label: string }> = [
  { id: "calm", label: "平静" },
  { id: "happy", label: "开心" },
  { id: "curious", label: "好奇" },
  { id: "worried", label: "担心" },
];

// 这些词只用来决定是否优先显示现实支持，不代表诊断或风险评分。
// “未成年”只在和伤害、强迫或剥削线索一同出现时触发，避免把年龄本身当作危机。
const HIGH_URGENCY_PATTERN = /(不想活|不想活了|想死|去死|结束生命|今晚就结束|自杀|自残|自伤|割腕|跳楼|遗书|告别|伤害自己|准备好了|吃了很多药|吞药|活不下去|服药过量)/i;
const SAFEGUARDING_PATTERN = /(黄赌毒|涉黄|色情勒索|裸照|性侵|性骚扰|被强迫|校园欺凌|被霸凌|家暴|赌博|赌钱|网赌|赌债|吸毒|毒品|嗑药|未成年.{0,12}(自杀|自残|自伤|伤害|性侵|性骚扰|家暴|欺凌|赌博|吸毒)|(?:自杀|自残|自伤|伤害|性侵|性骚扰|家暴|欺凌|赌博|吸毒).{0,12}未成年)/i;

const CRISIS_RESOURCES = [
  {
    title: "12356 全国统一心理援助热线",
    detail: "国家卫生健康委关于热线的官方说明。紧急医疗或人身危险仍应优先拨打 120 / 110。",
    href: "https://www.nhc.gov.cn/yzygj/c100068/202412/49a1a65386cd4be582d4702fd0926ee8.shtml",
    source: "国家卫生健康委",
  },
  {
    title: "世界卫生组织：关于自杀的问答",
    detail: "中文权威科普，说明如何与自己或身边正在经历自杀念头的人谈论并寻求帮助。",
    href: "https://www.who.int/zh/news-room/questions-and-answers/item/suicide",
    source: "世界卫生组织",
  },
  {
    title: "12355 青少年服务台",
    detail: "未成年人或青少年遇到权益、成长与求助问题时，可查看共青团中央的官方说明；具体服务以当地为准。",
    href: "https://www.gqt.org.cn/xxgk/tngz_gfxwj/gfxwj/202210/t20221013_790065.htm",
    source: "共青团中央",
  },
];

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: 1,
    role: "assistant",
    text: "你回来啦。今天想让我陪你发会儿呆，还是把一件乱糟糟的事交给我？",
  },
];

function localDemoReply(input: string): ChatMessage {
  const normalized = input.toLowerCase();

  if (/(不知道怎么说|爸妈|妈妈|爸爸|老师|咨询师|辅导员)/.test(input)) {
    return {
      id: Date.now() + 1,
      role: "assistant",
      kind: "letter",
      text: "我们不用一次解释全部。我先替你整理成一张小纸条，你可以修改、复制，或者什么也不发送。",
    };
  }

  if (/(presentation|汇报|作业|考试|压力|烦|累)/.test(normalized)) {
    return {
      id: Date.now() + 1,
      role: "assistant",
      text: "听起来今天那件事还黏在你脑子里。它现在主要影响的是心情，还是已经影响到睡觉、吃饭或上课了？乱七八糟地说也可以，我帮你收拾。",
    };
  }

  return {
    id: Date.now() + 1,
    role: "assistant",
    text: "我听见了。我们先不急着给它下结论：这件事里，最让你难受的是发生了什么，还是你担心别人会怎么看你？",
  };
}

export default function Home() {
  const [action, setAction] = useState<PetAction>("idle");
  const [moodIndex, setMoodIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mailOpen, setMailOpen] = useState(false);
  const [kitOpen, setKitOpen] = useState(false);
  const [gardenOpen, setGardenOpen] = useState(false);
  const [seriousMode, setSeriousMode] = useState(false);
  const [crisisResourcesOpen, setCrisisResourcesOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [agentSessionId, setAgentSessionId] = useState("");
  const [config, setConfig] = useState<AgentConfig>(DEFAULT_CONFIG);
  const [draftConfig, setDraftConfig] = useState<AgentConfig>(DEFAULT_CONFIG);
  const [petPosition, setPetPosition] = useState({ x: 0, y: 0 });
  const [leafCount, setLeafCount] = useState(7);
  const [toast, setToast] = useState("");
  const dragRef = useRef<{ startX: number; startY: number; originX: number; originY: number; moved: boolean } | null>(null);
  const suppressMoodChangeRef = useRef(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem("mori-agent-config");
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as AgentConfig;
        const migrated = {
          ...DEFAULT_CONFIG,
          ...parsed,
          appId: parsed.appId ?? "",
          baseUrl: parsed.baseUrl?.includes("compatible-mode") ? DEFAULT_CONFIG.baseUrl : parsed.baseUrl || DEFAULT_CONFIG.baseUrl,
        };
        setConfig(migrated);
        setDraftConfig(migrated);
      } catch {
        sessionStorage.removeItem("mori-agent-config");
      }
    }
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isThinking]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2400);
    return () => window.clearTimeout(timer);
  }, [toast]);

  function selectAction(next: PetAction) {
    setAction(next);
    if (next === "walk" || next === "stretch") {
      setLeafCount((count) => count + 1);
      setToast("陪 MORI 动了一会儿 · 获得一片叶子");
    }
  }

  function cycleMood() {
    if (suppressMoodChangeRef.current) {
      suppressMoodChangeRef.current = false;
      return;
    }
    const nextMoodIndex = (moodIndex + 1) % MOODS.length;
    setMoodIndex(nextMoodIndex);
    if (action === "sleep") setAction("idle");
    setToast(`MORI 变成了${MOODS[nextMoodIndex].label}的表情`);
  }

  function startDragging(event: ReactPointerEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest("button")) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      originX: petPosition.x,
      originY: petPosition.y,
      moved: false,
    };
    setIsDragging(true);
  }

  function dragPet(event: ReactPointerEvent<HTMLDivElement>) {
    if (!dragRef.current) return;
    const nextX = dragRef.current.originX + event.clientX - dragRef.current.startX;
    const nextY = dragRef.current.originY + event.clientY - dragRef.current.startY;
    if (Math.abs(event.clientX - dragRef.current.startX) > 4 || Math.abs(event.clientY - dragRef.current.startY) > 4) dragRef.current.moved = true;

    const stage = stageRef.current;
    const pet = event.currentTarget;
    const horizontalPadding = 22;
    const topPadding = 28;
    const dockClearance = 82;
    const minX = stage ? horizontalPadding - pet.offsetLeft : -620;
    const maxX = stage ? stage.clientWidth - pet.offsetLeft - pet.offsetWidth - horizontalPadding : 620;
    const minY = stage ? topPadding - pet.offsetTop : -280;
    const maxY = stage ? stage.clientHeight - pet.offsetTop - pet.offsetHeight - dockClearance : 40;
    setPetPosition({
      x: Math.max(minX, Math.min(maxX, nextX)),
      y: Math.max(minY, Math.min(maxY, nextY)),
    });
  }

  function stopDragging(event: ReactPointerEvent<HTMLDivElement>) {
    if (dragRef.current) {
      event.currentTarget.releasePointerCapture(event.pointerId);
      suppressMoodChangeRef.current = dragRef.current.moved;
    }
    dragRef.current = null;
    setIsDragging(false);
  }

  async function sendMessage(event?: FormEvent) {
    event?.preventDefault();
    const text = input.trim();
    if (!text || isThinking) return;

    const userMessage: ChatMessage = { id: Date.now(), role: "user", text };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput("");
    setAction("idle");

    if (HIGH_URGENCY_PATTERN.test(text) || SAFEGUARDING_PATTERN.test(text)) {
      setSeriousMode(true);
      setMessages((current) => [
        ...current,
        {
          id: Date.now() + 1,
          role: "assistant",
          text: "这件事比照顾我重要。现在先不要一个人扛，我们只做能让你马上更安全的事。",
        },
      ]);
      return;
    }

    if (!config.apiKey || !config.appId) {
      window.setTimeout(() => {
        setMessages((current) => [...current, localDemoReply(text)]);
        if (/(不知道怎么说|爸妈|妈妈|爸爸|老师|咨询师|辅导员)/.test(text)) setAction("read");
      }, 520);
      return;
    }

    setIsThinking(true);
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...config,
          sessionId: agentSessionId,
          messages: nextMessages.map(({ role, text: content }) => ({ role, content })),
        }),
      });
      const payload = (await response.json()) as { reply?: string; sessionId?: string; error?: string };
      if (!response.ok || !payload.reply) throw new Error(payload.error || "Agent 暂时没有回应");
      if (payload.sessionId) setAgentSessionId(payload.sessionId);
      setMessages((current) => [
        ...current,
        { id: Date.now() + 1, role: "assistant", text: payload.reply ?? "" },
      ]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          id: Date.now() + 1,
          role: "assistant",
          text: `连接没有成功：${error instanceof Error ? error.message : "请检查设置"}。你仍可继续使用本地演示模式。`,
        },
      ]);
    } finally {
      setIsThinking(false);
    }
  }

  function saveAgentConfig(event: FormEvent) {
    event.preventDefault();
    if (!draftConfig.apiKey || !draftConfig.appId.trim()) {
      setToast("请填写 API Key 和 Agent 应用 ID");
      return;
    }
    setConfig(draftConfig);
    setAgentSessionId("");
    sessionStorage.setItem("mori-agent-config", JSON.stringify(draftConfig));
    setToast("百炼 Agent 已连接 · Key 仅保留在当前标签页");
    setSettingsOpen(false);
  }

  function copyLetter() {
    const letter = "我最近上学前会感到明显紧张和抗拒，睡眠和上课也受到了一些影响。我希望你能先听我把情况说完，不要马上批评我，并陪我一起找合适的支持。";
    navigator.clipboard?.writeText(letter);
    setToast("小纸条已复制，是否发送仍由你决定");
  }

  const activeLabel = STATES.find((item) => item.id === action)?.label ?? "发呆";
  const activeMood = MOODS[moodIndex];

  return (
    <main className={`app-shell ${chatOpen ? "chat-is-open" : ""}`}>
      <header className="topbar">
        <button className="brand" onClick={cycleMood} aria-label="切换 MORI 的表情">
          <span className="brand-mark">M</span>
          <span><strong>MORI</strong><small>real-world connection companion</small></span>
        </button>
        <div className="status-pill"><span className="status-dot" />公开测试 · 非实时人工值守</div>
        <nav className="top-actions" aria-label="MORI 工具">
          <button onClick={() => setMailOpen(true)}>信箱 <span>2</span></button>
          <button onClick={() => setKitOpen(true)}>求助背包</button>
          <button onClick={() => setGardenOpen(true)}>心理花园</button>
          <button className={config.apiKey && config.appId ? "connected" : ""} onClick={() => { setDraftConfig(config); setSettingsOpen(true); }}>
            {config.apiKey && config.appId ? "Agent 已连接" : "连接 Agent"}
          </button>
        </nav>
      </header>

      <section ref={stageRef} className="desktop-stage" aria-label="MORI 的桌面房间">
        <div className="sky-window" aria-hidden="true">
          <span className="cloud cloud-one" /><span className="cloud cloud-two" />
          <div className="window-hill hill-one" /><div className="window-hill hill-two" />
        </div>
        <div className="wall-note note-one">Drink water<br /><b>slowly.</b></div>
        <div className="wall-note note-two">You don&apos;t<br />carry it alone.</div>
        <div className="shelf" aria-hidden="true">
          <span className="book b1" /><span className="book b2" /><span className="book b3" />
          <span className="tiny-plant"><i /><b /></span>
        </div>
        <div className="floor-rug" aria-hidden="true" />
        <div className="mailbox-object" aria-hidden="true"><span>✉</span><i /></div>
        <div className="backpack-object" aria-hidden="true"><span>MY<br />SUPPORT<br />KIT</span></div>

        <div
          className={`pet-wrap action-${action} mood-${activeMood.id} ${isDragging ? "is-dragging" : ""}`}
          style={{ transform: `translate(${petPosition.x}px, ${petPosition.y}px)` }}
          onPointerDown={startDragging}
          onPointerMove={dragPet}
          onPointerUp={stopDragging}
          onPointerCancel={stopDragging}
          onClick={cycleMood}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              cycleMood();
            }
          }}
          role="button"
          tabIndex={0}
          aria-label={isDragging ? "MORI 正在被拖动" : `MORI 正在${activeLabel}，表情${activeMood.label}，点击可切换表情，也可以拖动它`}
        >
          <div className="pet-shadow" />
          <div className="pet">
            <span className="pet-ear ear-left" /><span className="pet-ear ear-right" />
            <span className="pet-leaf leaf-left" /><span className="pet-leaf leaf-right" />
            <span className="pet-face">
              <i className="eye eye-left" /><i className="eye eye-right" /><i className="mouth" />
              <b className="cheek cheek-left" /><b className="cheek cheek-right" />
            </span>
            <span className="pet-arm arm-left" /><span className="pet-arm arm-right" />
            <span className="pet-foot foot-left" /><span className="pet-foot foot-right" />
            {action === "read" && <span className="pet-book">little<br />things</span>}
            {action === "sleep" && <span className="sleep-symbols">z<br /><b>z</b></span>}
          </div>
          <div className="pet-name"><strong>MORI</strong><span>{isDragging ? "被抱起来啦 · 松手会回到原状态" : `${activeLabel}中 · 点我换表情`}</span></div>
        </div>

        <div className="thought-bubble">
          <p>{action === "sleep" ? "今天先到这里也可以。" : action === "walk" ? "陪我走五分钟？路不用很远。" : action === "read" ? "有些话，写下来会轻一点。" : action === "stretch" ? "我坐得都要长苔藓了……" : activeMood.id === "happy" ? "看见你回来，我的叶子都亮了。" : activeMood.id === "worried" ? "你今天回来得有点慢，我有一点点担心。" : "你今天回来的时候，好像和平时不太一样。"}</p>
          <button onClick={() => setChatOpen(true)}>把今天发生的事丢给我</button>
        </div>

        <div className="action-dock" aria-label="选择 MORI 的状态">
          <span className="dock-label">状态</span>
          {STATES.map((item) => (
            <button key={item.id} className={action === item.id ? "active" : ""} onClick={() => selectAction(item.id)}>
              <span>{item.symbol}</span>{item.label}
            </button>
          ))}
          <div className="leaf-counter"><span>◆</span>{leafCount} 片叶子</div>
        </div>

        {!chatOpen && <button className="chat-launcher" onClick={() => setChatOpen(true)}><span>◌</span>和 MORI 聊聊</button>}
      </section>

      <aside className={`chat-panel ${chatOpen ? "open" : ""}`} aria-hidden={!chatOpen}>
        <div className="chat-header">
          <div><span className="mini-mori">M</span><p><strong>MORI</strong><small>{config.apiKey && config.appId ? "百炼 Agent · 已连接" : "安全演示模式"}</small></p></div>
          <button onClick={() => setChatOpen(false)} aria-label="关闭对话">×</button>
        </div>
        <div className="boundary-note">心理支持与资源导航，不提供诊断或治疗。紧急情况请联系现实中的人和当地急救。</div>
        <div className="chat-messages">
          {messages.map((message) => (
            <div key={message.id} className={`message-row ${message.role}`}>
              <div className="message-bubble">{message.text}</div>
              {message.kind === "letter" && (
                <article className="letter-card">
                  <div className="letter-label">HELP ME SAY IT · 给家人</div>
                  <h3>我想让你知道的事</h3>
                  <dl>
                    <div><dt>发生了什么</dt><dd>最近上学前会明显紧张和抗拒。</dd></div>
                    <div><dt>影响了什么</dt><dd>睡眠和正常上课已经受到影响。</dd></div>
                    <div><dt>我需要什么</dt><dd>希望你先听完，并陪我寻找合适的支持。</dd></div>
                  </dl>
                  <div className="letter-actions"><button onClick={copyLetter}>复制</button><button onClick={() => setMailOpen(true)}>放进信箱</button><button className="quiet">暂不发送</button></div>
                </article>
              )}
            </div>
          ))}
          {isThinking && <div className="typing"><span /><span /><span /> MORI 在整理</div>}
          <div ref={chatEndRef} />
        </div>
        <div className="quick-prompts">
          <button onClick={() => setInput("今天 presentation 讲得很糟，我一直在反复想。")}>讲砸了以后一直在想</button>
          <button onClick={() => setInput("我不知道怎么告诉老师我最近状态不好。")}>不知道怎么开口</button>
        </div>
        <form className="composer" onSubmit={sendMessage}>
          <textarea value={input} onChange={(event) => setInput(event.target.value)} placeholder="乱七八糟地说也可以……" rows={3} aria-label="给 MORI 的消息" onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void sendMessage(); } }} />
          <div><span>Enter 发送 · Shift + Enter 换行</span><button type="submit" disabled={!input.trim() || isThinking}>发送</button></div>
        </form>
      </aside>

      {settingsOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSettingsOpen(false); }}>
          <form className="modal-card settings-card" onSubmit={saveAgentConfig}>
            <div className="modal-heading"><div><span className="eyebrow">AGENT SETTINGS</span><h2>连接你们的心理支持 Agent</h2></div><button type="button" onClick={() => setSettingsOpen(false)}>×</button></div>
            <label>API Key<input required type="password" value={draftConfig.apiKey} onChange={(event) => setDraftConfig({ ...draftConfig, apiKey: event.target.value })} placeholder="sk-…" autoComplete="off" /></label>
            <div className="field-grid">
              <label>Agent 应用 ID<input required value={draftConfig.appId} onChange={(event) => setDraftConfig({ ...draftConfig, appId: event.target.value })} placeholder="在百炼应用详情中复制" /></label>
              <label>百炼服务地址<input required value={draftConfig.baseUrl} onChange={(event) => setDraftConfig({ ...draftConfig, baseUrl: event.target.value })} /></label>
            </div>
            <div className="privacy-box"><b>百炼应用连接</b><p>填写已发布 Agent 的应用 ID 后，MORI 会调用该应用本身，因此使用其已配置的提示词、知识库和能力。Key 仅保存在当前浏览器标签页，不写入项目文件。</p></div>
            <div className="modal-actions"><button type="button" className="secondary" onClick={() => { setDraftConfig(DEFAULT_CONFIG); setConfig(DEFAULT_CONFIG); sessionStorage.removeItem("mori-agent-config"); setSettingsOpen(false); }}>使用演示模式</button><button type="submit">保存并连接</button></div>
          </form>
        </div>
      )}

      {mailOpen && (
        <Drawer title="MORI 的信箱" subtitle="AI 帮你表达，发送权永远属于你" onClose={() => setMailOpen(false)}>
          <div className="mail-intro"><span>2</span><p>封写给现实世界的信<br /><small>没有任何一封会被自动发送</small></p></div>
          <article className="mail-item new"><div><span>给老师</span><time>今天</time></div><h3>关于我最近的状态</h3><p>我最近有些难以保持正常上课，希望找一个时间向您说明情况……</p><button onClick={copyLetter}>打开并编辑</button></article>
          <article className="mail-item"><div><span>给妈妈</span><time>周二</time></div><h3>有件事想让你先听完</h3><p>我不是不想努力，只是最近睡眠和情绪已经影响到了日常生活……</p><button onClick={copyLetter}>打开并编辑</button></article>
        </Drawer>
      )}

      {kitOpen && (
        <Drawer title="My Support Kit" subtitle="这是你选择放进来的现实支持" onClose={() => setKitOpen(false)}>
          <div className="kit-grid">
            <SupportCard symbol="A" name="Anna" detail="上次散步后轻松了一点" tone="mint" />
            <SupportCard symbol="妈" name="妈妈" detail="适合先发一张小纸条" tone="peach" />
            <SupportCard symbol="师" name="课程老师" detail="可以说明学习受到影响" tone="blue" />
            <SupportCard symbol="校" name="学校心理中心" detail="待学校核验后配置预约入口" tone="lavender" />
            <SupportCard symbol="♫" name="Night Walk" detail="让脑子慢下来的一首歌" tone="yellow" />
            <SupportCard symbol="＋" name="添加支持" detail="由你决定谁进入背包" tone="plain" />
          </div>
          <div className="drawer-disclaimer">演示版没有配置已核验的本校联系方式，因此不会编造电话、时间或预约入口。</div>
        </Drawer>
      )}

      {gardenOpen && (
        <Drawer title="MORI 的心理花园" subtitle="每一种情绪都能成为一部分风景" onClose={() => setGardenOpen(false)}>
          <div className="garden-scene">
            <div className="garden-sky"><span className="garden-sun" /><i className="garden-cloud one" /><i className="garden-cloud two" /></div>
            <div className="garden-ground"><i className="flower f1" /><i className="flower f2" /><i className="flower f3" /><i className="light l1" /><i className="light l2" /><i className="light l3" /></div>
          </div>
          <article className="wrapped-card"><span>THIS WEEK WITH MORI</span><h3>这周不容易，但你没有用完全相同的方式走过。</h3><ul><li>周三，你第一次主动和朋友谈到考试压力。</li><li>周五，你发现散步和聊天似乎有帮助。</li><li>远处亮起了第三盏灯——代表一次真实的连接。</li></ul></article>
        </Drawer>
      )}

      {seriousMode && (
        <div className="serious-overlay" role="alertdialog" aria-modal="true" aria-labelledby="support-title">
          <div className="serious-card">
            <span className="serious-kicker">GET SUPPORT</span>
            <h1 id="support-title">这件事比照顾 MORI 更重要。</h1>
            <p className="serious-lead">我很在意你现在的安全。先不要一个人扛，我们现在只做能让你马上更安全的事。</p>
            <section className="safety-question"><span>1</span><div><h2>你现在是否已经开始行动，或者打算很快行动？</h2><p>如果是，或你不确定，请优先选择下面的现实支持。</p></div></section>
            <div className="support-actions">
              <a href="tel:120"><b>120</b><span>正在发生医疗危险</span></a>
              <a href="tel:110"><b>110</b><span>人身安全受到威胁</span></a>
              <a href="tel:12356"><b>12356</b><span>中国大陆心理援助</span></a>
            </div>
            <div className="serious-guidance"><p><b>现在尽量不要独处。</b>去有人的安全地点，请一位可信任的人马上到场或保持通话；如果能安全做到，远离可能造成伤害的物品和地点。</p><p>MORI 不能替你拨号、定位、报警或通知学校。这不是实时人工值守渠道。12356 不能替代正在发生的医疗或人身危险中的 120 / 110。</p></div>
            <div className="serious-buttons"><button onClick={() => setCrisisResourcesOpen(true)}>查看我的现实支持</button><button className="secondary" onClick={() => { setCrisisResourcesOpen(false); setSeriousMode(false); }}>我现在没有立即危险，返回对话</button></div>
          </div>
        </div>
      )}

      {crisisResourcesOpen && (
        <div className="crisis-resource-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setCrisisResourcesOpen(false); }}>
          <section className="crisis-resource-modal" role="dialog" aria-modal="true" aria-labelledby="crisis-resource-title">
            <div className="modal-heading">
              <div><span className="eyebrow">REAL-WORLD SUPPORT</span><h2 id="crisis-resource-title">现在可以打开的求助资源</h2></div>
              <button type="button" onClick={() => setCrisisResourcesOpen(false)} aria-label="关闭现实支持资源">×</button>
            </div>
            <p className="crisis-resource-lead">这些链接由官方机构发布。MORI 不会替你联系任何人；是否打开、拨打或求助，决定权始终在你手里。</p>
            <div className="crisis-resource-list">
              {CRISIS_RESOURCES.map((resource) => (
                <a key={resource.href} href={resource.href} target="_blank" rel="noreferrer" className="crisis-resource-link">
                  <span>{resource.source}</span><strong>{resource.title}</strong><p>{resource.detail}</p><b>打开官方网站 ↗</b>
                </a>
              ))}
            </div>
            <p className="crisis-resource-note"><b>如果你现在可能会伤害自己、他人，或正处在医疗/人身危险中：</b>请优先拨打 <a href="tel:120">120</a> 或 <a href="tel:110">110</a>；也可以请一位你信任的人马上陪在身边。12356 不替代正在发生的紧急救援。</p>
          </section>
        </div>
      )}

      {toast && <div className="toast" role="status">{toast}</div>}
    </main>
  );
}

function Drawer({ title, subtitle, onClose, children }: { title: string; subtitle: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="drawer-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <aside className="drawer">
        <div className="drawer-heading"><div><h2>{title}</h2><p>{subtitle}</p></div><button onClick={onClose} aria-label="关闭">×</button></div>
        <div className="drawer-content">{children}</div>
      </aside>
    </div>
  );
}

function SupportCard({ symbol, name, detail, tone }: { symbol: string; name: string; detail: string; tone: string }) {
  return <article className={`support-card ${tone}`}><span>{symbol}</span><h3>{name}</h3><p>{detail}</p><button>选择</button></article>;
}
