"use client";

import { FormEvent, PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from "react";

type PetAction = "idle" | "walk" | "sleep" | "read" | "stretch" | "happy";
type ChatMessage = {
  id: number;
  role: "user" | "assistant";
  text: string;
  kind?: "letter";
};

type AgentConfig = {
  apiKey: string;
  baseUrl: string;
  model: string;
};

const DEFAULT_CONFIG: AgentConfig = {
  apiKey: "",
  baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
  model: "qwen-plus",
};

const ACTIONS: Array<{ id: PetAction; label: string; symbol: string }> = [
  { id: "idle", label: "发呆", symbol: "···" },
  { id: "walk", label: "散步", symbol: "↝" },
  { id: "read", label: "看书", symbol: "▤" },
  { id: "sleep", label: "睡觉", symbol: "☾" },
  { id: "stretch", label: "伸懒腰", symbol: "↟" },
  { id: "happy", label: "开心", symbol: "✦" },
];

const HIGH_URGENCY_PATTERN = /(不想活|结束生命|今晚就结束|自杀|伤害自己|准备好了|吃了很多药|跳楼|活不下去)/i;

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
  const [chatOpen, setChatOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mailOpen, setMailOpen] = useState(false);
  const [kitOpen, setKitOpen] = useState(false);
  const [gardenOpen, setGardenOpen] = useState(false);
  const [seriousMode, setSeriousMode] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [config, setConfig] = useState<AgentConfig>(DEFAULT_CONFIG);
  const [draftConfig, setDraftConfig] = useState<AgentConfig>(DEFAULT_CONFIG);
  const [petPosition, setPetPosition] = useState({ x: 0, y: 0 });
  const [leafCount, setLeafCount] = useState(7);
  const [toast, setToast] = useState("");
  const dragRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem("mori-agent-config");
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as AgentConfig;
        setConfig(parsed);
        setDraftConfig(parsed);
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

  function startDragging(event: ReactPointerEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest("button")) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      originX: petPosition.x,
      originY: petPosition.y,
    };
  }

  function dragPet(event: ReactPointerEvent<HTMLDivElement>) {
    if (!dragRef.current) return;
    const nextX = dragRef.current.originX + event.clientX - dragRef.current.startX;
    const nextY = dragRef.current.originY + event.clientY - dragRef.current.startY;
    setPetPosition({
      x: Math.max(-260, Math.min(260, nextX)),
      y: Math.max(-110, Math.min(80, nextY)),
    });
  }

  function stopDragging(event: ReactPointerEvent<HTMLDivElement>) {
    if (dragRef.current) event.currentTarget.releasePointerCapture(event.pointerId);
    dragRef.current = null;
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

    if (HIGH_URGENCY_PATTERN.test(text)) {
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

    if (!config.apiKey) {
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
          messages: nextMessages.map(({ role, text: content }) => ({ role, content })),
        }),
      });
      const payload = (await response.json()) as { reply?: string; error?: string };
      if (!response.ok || !payload.reply) throw new Error(payload.error || "Agent 暂时没有回应");
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
    setConfig(draftConfig);
    if (draftConfig.apiKey) {
      sessionStorage.setItem("mori-agent-config", JSON.stringify(draftConfig));
      setToast("Agent 已连接 · Key 仅保留在当前标签页");
    } else {
      sessionStorage.removeItem("mori-agent-config");
      setToast("已切换为本地演示模式");
    }
    setSettingsOpen(false);
  }

  function copyLetter() {
    const letter = "我最近上学前会感到明显紧张和抗拒，睡眠和上课也受到了一些影响。我希望你能先听我把情况说完，不要马上批评我，并陪我一起找合适的支持。";
    navigator.clipboard?.writeText(letter);
    setToast("小纸条已复制，是否发送仍由你决定");
  }

  const activeLabel = ACTIONS.find((item) => item.id === action)?.label ?? "发呆";

  return (
    <main className={`app-shell ${chatOpen ? "chat-is-open" : ""}`}>
      <header className="topbar">
        <button className="brand" onClick={() => selectAction("happy")} aria-label="让 MORI 开心">
          <span className="brand-mark">M</span>
          <span><strong>MORI</strong><small>real-world connection companion</small></span>
        </button>
        <div className="status-pill"><span className="status-dot" />公开测试 · 非实时人工值守</div>
        <nav className="top-actions" aria-label="MORI 工具">
          <button onClick={() => setMailOpen(true)}>信箱 <span>2</span></button>
          <button onClick={() => setKitOpen(true)}>求助背包</button>
          <button onClick={() => setGardenOpen(true)}>心理花园</button>
          <button className={config.apiKey ? "connected" : ""} onClick={() => { setDraftConfig(config); setSettingsOpen(true); }}>
            {config.apiKey ? "Agent 已连接" : "连接 Agent"}
          </button>
        </nav>
      </header>

      <section className="desktop-stage" aria-label="MORI 的桌面房间">
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
          className={`pet-wrap action-${action}`}
          style={{ transform: `translate(${petPosition.x}px, ${petPosition.y}px)` }}
          onPointerDown={startDragging}
          onPointerMove={dragPet}
          onPointerUp={stopDragging}
          onPointerCancel={stopDragging}
          role="img"
          aria-label={`MORI 正在${activeLabel}，可以拖动它`}
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
          <div className="pet-name"><strong>MORI</strong><span>{activeLabel}中 · 拖动我试试</span></div>
        </div>

        <div className="thought-bubble">
          <p>{action === "sleep" ? "今天先到这里也可以。" : action === "walk" ? "陪我走五分钟？路不用很远。" : action === "read" ? "有些话，写下来会轻一点。" : action === "stretch" ? "我坐得都要长苔藓了……" : action === "happy" ? "看见你回来，我的叶子都亮了。" : "你今天回来的时候，好像和平时不太一样。"}</p>
          <button onClick={() => setChatOpen(true)}>把今天发生的事丢给我</button>
        </div>

        <div className="action-dock" aria-label="选择 MORI 的动作">
          {ACTIONS.map((item) => (
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
          <div><span className="mini-mori">M</span><p><strong>MORI</strong><small>{config.apiKey ? `${config.model} · 已连接` : "安全演示模式"}</small></p></div>
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
            <label>API Key<input type="password" value={draftConfig.apiKey} onChange={(event) => setDraftConfig({ ...draftConfig, apiKey: event.target.value })} placeholder="sk-…" autoComplete="off" /></label>
            <div className="field-grid">
              <label>模型<input value={draftConfig.model} onChange={(event) => setDraftConfig({ ...draftConfig, model: event.target.value })} placeholder="qwen-plus" /></label>
              <label>服务地址<input value={draftConfig.baseUrl} onChange={(event) => setDraftConfig({ ...draftConfig, baseUrl: event.target.value })} /></label>
            </div>
            <div className="privacy-box"><b>公开测试说明</b><p>Key 仅保存在当前浏览器标签页。发送消息时会经服务端代理转发到所选模型服务，不写入项目文件。正式提供真实 Agent 时，应改用 Cloudflare Secret 并补充机构隐私政策。</p></div>
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
            <div className="serious-buttons"><button onClick={() => setKitOpen(true)}>查看我的现实支持</button><button className="secondary" onClick={() => setSeriousMode(false)}>我现在没有立即危险，返回对话</button></div>
          </div>
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
