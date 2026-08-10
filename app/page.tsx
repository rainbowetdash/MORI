"use client";

import { ChangeEvent, FormEvent, PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from "react";

type PetAction = "idle" | "walk" | "sleep" | "read" | "stretch";
type PetMood = "calm" | "happy" | "curious" | "worried";
type ChatMessage = {
  id: number;
  role: "user" | "assistant";
  text: string;
  kind?: "letter";
};

type LetterRecipient = "树洞" | "家人" | "朋友" | "伴侣" | "专业人士";
type LetterDraft = {
  id: string;
  recipient: LetterRecipient;
  title: string;
  body: string;
  source: string;
  savedAt?: number;
};

type GardenKind = "sunflower" | "iris" | "berry" | "lake" | "mist" | "hill" | "light";
type GardenMoment = { id: string; kind: GardenKind; createdAt: number };
type JournalPaper = "peach" | "sky" | "lilac" | "sunshine";
type JournalSticker = { id: string; symbol: string; x: number; y: number; rotation: number };
type JournalEntry = { id: string; title: string; body: string; stickers: JournalSticker[]; photos: string[]; paper: JournalPaper; createdAt: number; updatedAt: number };

const LETTER_RECIPIENTS: LetterRecipient[] = ["树洞", "家人", "朋友", "伴侣", "专业人士"];
const JOURNAL_STICKERS = [
  { symbol: "✿", label: "小花" }, { symbol: "☁", label: "云朵" }, { symbol: "☾", label: "月亮" },
  { symbol: "✦", label: "星光" }, { symbol: "♥", label: "心事" }, { symbol: "🍓", label: "草莓" },
  { symbol: "🫖", label: "茶点" }, { symbol: "🎧", label: "音乐" }, { symbol: "🪴", label: "新芽" },
];
const JOURNAL_PAPERS: Array<{ id: JournalPaper; label: string }> = [
  { id: "peach", label: "蜜桃纸" }, { id: "sky", label: "晴空纸" }, { id: "lilac", label: "鸢尾纸" }, { id: "sunshine", label: "阳光纸" },
];
const GARDEN_OPTIONS: Array<{ kind: GardenKind; label: string; detail: string; symbol: string }> = [
  { kind: "sunflower", label: "一点开心", detail: "种下一朵向日葵", symbol: "✿" },
  { kind: "iris", label: "有些难过", detail: "留下一株蓝色鸢尾", symbol: "✾" },
  { kind: "berry", label: "我很生气", detail: "结下一颗红色浆果", symbol: "●" },
  { kind: "lake", label: "慢慢平静", detail: "让湖面亮一点", symbol: "≈" },
  { kind: "mist", label: "还很迷茫", detail: "留下一点雾", symbol: "☁" },
  { kind: "hill", label: "做了件勇敢的事", detail: "长出一段山坡", symbol: "△" },
  { kind: "light", label: "我去找人了", detail: "点亮一盏现实连接的灯", symbol: "✦" },
];

type ModelProvider = "openai" | "anthropic" | "gemini" | "compatible";
type ConnectionStatus = "demo" | "configured" | "verified" | "failed";

type AgentConfig = {
  provider: ModelProvider;
  apiKey: string;
  model: string;
  baseUrl: string;
};

const DEFAULT_CONFIG: AgentConfig = {
  provider: "openai",
  apiKey: "",
  model: "chat-latest",
  baseUrl: "https://api.openai.com",
};

const PROVIDERS: Array<{ id: ModelProvider; label: string; baseUrl: string; model: string; hint: string }> = [
  { id: "openai", label: "OpenAI", baseUrl: "https://api.openai.com", model: "chat-latest", hint: "OpenAI 官方接口" },
  { id: "anthropic", label: "Anthropic", baseUrl: "https://api.anthropic.com", model: "claude-sonnet-4-5", hint: "Claude 原生接口" },
  { id: "gemini", label: "Google Gemini", baseUrl: "https://generativelanguage.googleapis.com", model: "gemini-2.5-flash", hint: "Gemini 原生接口" },
  { id: "compatible", label: "OpenAI 兼容接口", baseUrl: "", model: "", hint: "OpenRouter、硅基流动及其他兼容服务" },
];

const STATES: Array<{ id: PetAction; label: string; symbol: string }> = [
  { id: "idle", label: "发呆", symbol: "···" },
  { id: "walk", label: "散步", symbol: "↝" },
  { id: "read", label: "看书", symbol: "▤" },
  { id: "sleep", label: "睡觉", symbol: "☾" },
  { id: "stretch", label: "伸懒腰", symbol: "↟" },
];
const ACTION_LINES: Record<PetAction, string[]> = {
  idle: ["我在这里发会儿呆。", "今天的光落得很慢。", "不做什么也可以。"],
  walk: ["陪我走几步吧。", "慢慢走，也是在往前。", "脚步轻一点，心也会松一点。"],
  read: ["翻一页，世界就安静一点。", "这一段我想读得慢一些。", "字里也藏着小小的休息。"],
  sleep: ["ZZZZZ…", "zzzzz…", "ZZZZzzzz…"],
  stretch: ["伸个懒腰，把雾散一点。", "身体先醒过来啦。", "把肩膀放松一点点。"],
};

const MOODS: Array<{ id: PetMood; label: string }> = [
  { id: "calm", label: "平静" },
  { id: "happy", label: "开心" },
  { id: "curious", label: "好奇" },
  { id: "worried", label: "担心" },
];

// 这些词只用来决定是否优先显示现实支持，不代表诊断或风险评分。
// “未成年”只在和伤害、强迫或剥削线索一同出现时触发，避免把年龄本身当作危机。
const HIGH_URGENCY_PATTERN = /(不想活|不想活了|想死|去死|结束生命|今晚就结束|自杀|自残|自伤|割腕|跳楼|遗书|告别|伤害自己|准备好了|吃了很多药|吞药|活不下去|服药过量)/i;
const SAFEGUARDING_PATTERN = /(黄赌毒|涉黄|色情勒索|裸照|性侵|性骚扰|被强迫|欺凌|被霸凌|家暴|赌博|赌钱|网赌|赌债|吸毒|毒品|嗑药|未成年.{0,12}(自杀|自残|自伤|伤害|性侵|性骚扰|家暴|欺凌|赌博|吸毒)|(?:自杀|自残|自伤|伤害|性侵|性骚扰|家暴|欺凌|赌博|吸毒).{0,12}未成年)/i;

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

function newJournalSticker(symbol: string, index = 0): JournalSticker {
  const offset = index * 7;
  return { id: `sticker-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 6)}`, symbol, x: 74 - (offset % 21), y: 73 - (offset % 16), rotation: (index % 2 ? 7 : -7) };
}

function normalizeJournalEntry(entry: Partial<JournalEntry> & { stickers?: Array<JournalSticker | string> }): JournalEntry {
  const now = Date.now();
  return {
    id: entry.id || `journal-${now}`,
    title: entry.title || "",
    body: entry.body || "",
    stickers: (entry.stickers || []).map((sticker, index) => typeof sticker === "string" ? newJournalSticker(sticker, index) : { ...sticker, x: Math.max(4, Math.min(88, sticker.x)), y: Math.max(6, Math.min(84, sticker.y)) }),
    photos: Array.isArray(entry.photos) ? entry.photos : [],
    paper: entry.paper || "peach",
    createdAt: entry.createdAt || now,
    updatedAt: entry.updatedAt || now,
  };
}

function newJournalEntry(): JournalEntry {
  const now = Date.now();
  return { id: `journal-${now}`, title: "", body: "", stickers: [newJournalSticker("✿")], photos: [], paper: "peach", createdAt: now, updatedAt: now };
}

function localDemoReply(input: string): ChatMessage {
  const normalized = input.toLowerCase();

  if (/(不知道怎么说|爸妈|妈妈|爸爸|家人|朋友|伴侣|医生|咨询师)/.test(input)) {
    return {
      id: Date.now() + 1,
      role: "assistant",
      kind: "letter",
      text: "我们不用一次解释全部。我先替你整理成一张小纸条，你可以修改、复制，或者什么也不发送。",
    };
  }

  if (/(presentation|汇报|工作|任务|考试|压力|烦|累)/.test(normalized)) {
    return {
      id: Date.now() + 1,
      role: "assistant",
      text: "听起来今天那件事还黏在你脑子里。它现在主要影响的是心情，还是已经影响到睡觉、吃饭或日常安排了？乱七八糟地说也可以，我帮你收拾。",
    };
  }

  return {
    id: Date.now() + 1,
    role: "assistant",
    text: "我听见了。我们先不急着给它下结论：这件事里，最让你难受的是发生了什么，还是你担心别人会怎么看你？",
  };
}

function buildLetter(recipient: LetterRecipient, source: string) {
  const shared = source || "最近我有一些状态和困难，想找一个合适的人说一说。";
  if (recipient === "朋友") return {
    title: "有件事想和你说",
    body: `嗨，我想和你说一件最近有点难的事。${shared}\n\n我不一定需要你马上帮我解决，只是希望有人能先听我讲讲。如果你方便的话，能不能陪我聊一会儿，或者一起走走？\n\n谢谢你。`,
  };
  if (recipient === "伴侣") return {
    title: "有件事想和你认真说说",
    body: `我想和你认真说一件最近的事。${shared}\n\n我不希望你马上替我解决，也不是在责怪你。我更需要你先听我说完，等我准备好后，再一起想想下一步。\n\n谢谢你愿意在这里。`,
  };
  if (recipient === "专业人士") return {
    title: "想说明一下我最近的状态",
    body: `您好：\n\n我想说明一下最近的情况。${shared}\n\n这件事已经让我有些难以独自应对。我希望能进一步了解自己的可选支持，并约一个合适的时间沟通。\n\n谢谢。`,
  };
  return {
    title: "有件事想请你先听我说完",
    body: `我有件事想认真告诉你。${shared}\n\n我不是希望你马上替我下结论或批评我。我更希望你能先听我把情况说完；如果可以，我们再一起想想下一步能找谁帮忙。\n\n谢谢你愿意听。`,
  };
}

export default function Home() {
  const [action, setAction] = useState<PetAction>("idle");
  const [speechIndex, setSpeechIndex] = useState(0);
  const [moodIndex, setMoodIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mailOpen, setMailOpen] = useState(false);
  const [letterDrafts, setLetterDrafts] = useState<LetterDraft[]>([]);
  const [editingLetter, setEditingLetter] = useState<LetterDraft | null>(null);
  const [journalOpen, setJournalOpen] = useState(false);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [journalDraft, setJournalDraft] = useState<JournalEntry>(() => newJournalEntry());
  const [selectedJournalStickerId, setSelectedJournalStickerId] = useState<string | null>(null);
  const [gardenOpen, setGardenOpen] = useState(false);
  const [gardenMoments, setGardenMoments] = useState<GardenMoment[]>([]);
  const [seriousMode, setSeriousMode] = useState(false);
  const [crisisResourcesOpen, setCrisisResourcesOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [isVerifyingConnection, setIsVerifyingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("demo");
  const [config, setConfig] = useState<AgentConfig>(DEFAULT_CONFIG);
  const [draftConfig, setDraftConfig] = useState<AgentConfig>(DEFAULT_CONFIG);
  const [petPosition, setPetPosition] = useState({ x: 0, y: 0 });
  const [leafCount, setLeafCount] = useState(7);
  const [toast, setToast] = useState("");
  const dragRef = useRef<{ startX: number; startY: number; originX: number; originY: number; moved: boolean } | null>(null);
  const suppressMoodChangeRef = useRef(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLElement>(null);
  const actionRef = useRef<PetAction>("idle");
  const walkDirectionRef = useRef<1 | -1>(1);
  const journalPageRef = useRef<HTMLElement>(null);
  const journalStickerDragRef = useRef<{ id: string; startX: number; startY: number; originX: number; originY: number } | null>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem("mori-agent-config");
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as Partial<AgentConfig>;
        const migrated: AgentConfig = {
          ...DEFAULT_CONFIG,
          ...parsed,
          provider: parsed.provider ?? "compatible",
          model: parsed.model || "",
          baseUrl: parsed.baseUrl?.includes("dashscope.aliyuncs.com") ? "https://dashscope.aliyuncs.com/compatible-mode/v1" : parsed.baseUrl || DEFAULT_CONFIG.baseUrl,
        };
        setConfig(migrated);
        setDraftConfig(migrated);
        setConnectionStatus("configured");
      } catch {
        sessionStorage.removeItem("mori-agent-config");
      }
    }
  }, []);

  useEffect(() => { actionRef.current = action; }, [action]);

  useEffect(() => {
    let timer: number;
    const nextMoment = () => {
      const choices: PetAction[] = ["idle", "walk", "sleep", "read", "stretch"];
      const next = actionRef.current === "sleep" ? "read" : choices[Math.floor(Math.random() * choices.length)];
      setAction(next);
      setSpeechIndex(Math.floor(Math.random() * ACTION_LINES[next].length));
      timer = window.setTimeout(nextMoment, 45000 + Math.random() * 45000);
    };
    timer = window.setTimeout(nextMoment, 50000);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (action !== "walk" || isDragging) return;
    const moveAlongPath = () => {
      const stageWidth = stageRef.current?.clientWidth ?? 900;
      const horizontal = Math.max(150, Math.min(390, stageWidth / 2 - 120));
      setPetPosition((current) => ({
        x: (() => {
          const candidate = current.x + walkDirectionRef.current * 135;
          if (candidate >= horizontal || candidate <= -horizontal) walkDirectionRef.current *= -1;
          return Math.max(-horizontal, Math.min(horizontal, candidate));
        })(),
        y: Math.max(-72, Math.min(12, current.y + (Math.random() - .5) * 18)),
      }));
      setSpeechIndex(Math.floor(Math.random() * ACTION_LINES.walk.length));
    };
    const start = window.setTimeout(moveAlongPath, 80);
    const walker = window.setInterval(moveAlongPath, 5000);
    return () => {
      window.clearTimeout(start);
      window.clearInterval(walker);
    };
  }, [action, isDragging]);

  useEffect(() => {
    try {
      const savedJournal = localStorage.getItem("mori-journal-entries");
      if (savedJournal) {
        const parsed = JSON.parse(savedJournal) as Array<Partial<JournalEntry> & { stickers?: Array<JournalSticker | string> }>;
        if (Array.isArray(parsed)) setJournalEntries(parsed.map(normalizeJournalEntry));
      }
      const savedGarden = localStorage.getItem("mori-garden-moments");
      if (savedGarden) setGardenMoments(JSON.parse(savedGarden) as GardenMoment[]);
    } catch {
      localStorage.removeItem("mori-journal-entries");
      localStorage.removeItem("mori-garden-moments");
    }
  }, []);

  useEffect(() => {
    try {
      const savedDrafts = localStorage.getItem("mori-letter-drafts");
      if (savedDrafts) setLetterDrafts(JSON.parse(savedDrafts) as LetterDraft[]);
    } catch {
      localStorage.removeItem("mori-letter-drafts");
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
    setSpeechIndex((current) => (current + 1) % ACTION_LINES[next].length);
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
  }

  function dragPet(event: ReactPointerEvent<HTMLDivElement>) {
    if (!dragRef.current) return;
    const nextX = dragRef.current.originX + event.clientX - dragRef.current.startX;
    const nextY = dragRef.current.originY + event.clientY - dragRef.current.startY;
    if (!dragRef.current.moved) {
      const crossedDragThreshold = Math.abs(event.clientX - dragRef.current.startX) > 4 || Math.abs(event.clientY - dragRef.current.startY) > 4;
      if (!crossedDragThreshold) return;
      dragRef.current.moved = true;
      setIsDragging(true);
    }

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
    setSeriousMode(false);

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

    if (connectionStatus !== "verified") {
      if (connectionStatus !== "demo") {
        setMessages((current) => [...current, {
          id: Date.now() + 1,
          role: "assistant",
          text: "模型尚未验证，本条没有发送到模型服务。请打开「连接模型」，点击“验证并连接”后再试。",
        }]);
        return;
      }
      window.setTimeout(() => {
        setMessages((current) => [...current, localDemoReply(text)]);
        if (/(不知道怎么说|爸妈|妈妈|爸爸|家人|朋友|伴侣|医生|咨询师)/.test(text)) setAction("read");
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
      if (!response.ok || !payload.reply) throw new Error(payload.error || "模型暂时没有回应");
      setMessages((current) => [
        ...current,
        { id: Date.now() + 1, role: "assistant", text: payload.reply ?? "" },
      ]);
      setConnectionStatus("verified");
    } catch (error) {
      setConnectionStatus("failed");
      setMessages((current) => [
        ...current,
        {
          id: Date.now() + 1,
          role: "assistant",
          text: `连接没有成功：${error instanceof Error ? error.message : "请检查设置"}。未自动改用演示回复，请检查设置后重试。`,
        },
      ]);
    } finally {
      setIsThinking(false);
    }
  }

  async function saveAgentConfig(event: FormEvent) {
    event.preventDefault();
    if (!draftConfig.model.trim() || !draftConfig.baseUrl.trim() || (!draftConfig.apiKey && draftConfig.provider !== "compatible")) {
      setToast(draftConfig.provider === "compatible" ? "请填写模型名和接口地址" : "请填写 API Key、模型名和接口地址");
      return;
    }
    setIsVerifyingConnection(true);
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...draftConfig,
          messages: [{ role: "user", content: "请只回复“连接成功”。" }],
        }),
      });
      const payload = (await response.json()) as { reply?: string; error?: string };
      if (!response.ok || !payload.reply) throw new Error(payload.error || "模型没有返回可验证的文字");
      setConfig(draftConfig);
      sessionStorage.setItem("mori-agent-config", JSON.stringify(draftConfig));
      setConnectionStatus("verified");
      setToast("模型已验证可用 · 配置仅保留在当前标签页");
      setSettingsOpen(false);
    } catch (error) {
      setConnectionStatus("failed");
      setToast(`未能验证连接：${error instanceof Error ? error.message : "请检查设置"}`);
    } finally {
      setIsVerifyingConnection(false);
    }
  }

  function changeProvider(provider: ModelProvider) {
    const preset = PROVIDERS.find((item) => item.id === provider) ?? PROVIDERS[0];
    setDraftConfig((current) => ({ ...current, provider, baseUrl: preset.baseUrl, model: preset.model }));
  }

  function latestLetterSource() {
    const recentUserMessages = messages.filter((message) => message.role === "user").slice(-3).map((message) => message.text.trim()).filter(Boolean);
    return recentUserMessages.join("；") || "最近我有一些状态和困难，想找一个合适的人说一说。";
  }

  function openLetterEditor(recipient: LetterRecipient = "家人") {
    const source = latestLetterSource();
    const letter = buildLetter(recipient, source);
    setEditingLetter({ id: `letter-${Date.now()}`, recipient, source, ...letter });
    setMailOpen(true);
  }

  function changeLetterRecipient(recipient: LetterRecipient) {
    setEditingLetter((current) => current ? { ...current, recipient, ...buildLetter(recipient, current.source) } : current);
  }

  function saveLetterDraft() {
    if (!editingLetter) return;
    const saved = { ...editingLetter, title: editingLetter.title.trim() || "一封还没命名的信", body: editingLetter.body.trim(), savedAt: Date.now() };
    if (!saved.body) {
      setToast("先写一点想说的话，再保存吧");
      return;
    }
    setLetterDrafts((current) => {
      const next = [saved, ...current.filter((draft) => draft.id !== saved.id)];
      localStorage.setItem("mori-letter-drafts", JSON.stringify(next));
      return next;
    });
    setEditingLetter(saved);
    setToast("草稿已保存在这台设备的浏览器里");
  }

  function deleteLetterDraft(id: string) {
    setLetterDrafts((current) => {
      const next = current.filter((draft) => draft.id !== id);
      localStorage.setItem("mori-letter-drafts", JSON.stringify(next));
      return next;
    });
    if (editingLetter?.id === id) setEditingLetter(null);
    setToast("草稿已删除");
  }

  function copyLetter(letter = editingLetter) {
    if (!letter?.body) return;
    void navigator.clipboard?.writeText(`${letter.title}\n\n${letter.body}`);
    setToast("草稿已复制；是否发送仍由你决定");
  }

  function saveJournalEntry() {
    const entry = { ...journalDraft, title: journalDraft.title.trim() || "没有标题的一页", updatedAt: Date.now() };
    setJournalEntries((current) => {
      const next = [entry, ...current.filter((item) => item.id !== entry.id)].slice(0, 60);
      localStorage.setItem("mori-journal-entries", JSON.stringify(next));
      return next;
    });
    setJournalDraft(entry);
    setToast("这一页手账已经保存在这台设备上");
  }

  async function importJournalImages(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []);
    const available = Math.max(0, 4 - journalDraft.photos.length);
    const files = selected.filter((file) => file.type.startsWith("image/") && file.size <= 2 * 1024 * 1024).slice(0, available);
    event.target.value = "";
    if (!files.length) {
      setToast("请选择单张不超过 2MB 的图片");
      return;
    }
    const photos = await Promise.all(files.map((file) => new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("图片读取失败"));
      reader.readAsDataURL(file);
    })));
    setJournalDraft((current) => ({ ...current, photos: [...current.photos, ...photos].slice(0, 4) }));
    setToast(files.length < selected.length ? "已加入可用图片；每页最多 4 张、单张不超过 2MB" : "图片已经贴到这一页了");
  }

  function addJournalSticker(symbol: string) {
    const sticker = newJournalSticker(symbol, journalDraft.stickers.length);
    setJournalDraft((current) => ({ ...current, stickers: [...current.stickers, sticker] }));
    setSelectedJournalStickerId(sticker.id);
  }

  function openJournalEntry(entry: JournalEntry) {
    setJournalDraft({ ...entry, photos: [...entry.photos], stickers: entry.stickers.map((sticker) => ({ ...sticker })) });
    setSelectedJournalStickerId(null);
  }

  function startJournalStickerDrag(event: ReactPointerEvent<HTMLDivElement>, sticker: JournalSticker) {
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    journalStickerDragRef.current = { id: sticker.id, startX: event.clientX, startY: event.clientY, originX: sticker.x, originY: sticker.y };
    setSelectedJournalStickerId(sticker.id);
  }

  function moveJournalSticker(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = journalStickerDragRef.current;
    const page = journalPageRef.current;
    if (!drag || !page) return;
    const bounds = page.getBoundingClientRect();
    const x = Math.max(4, Math.min(88, drag.originX + ((event.clientX - drag.startX) / bounds.width) * 100));
    const y = Math.max(6, Math.min(84, drag.originY + ((event.clientY - drag.startY) / bounds.height) * 100));
    setJournalDraft((current) => ({ ...current, stickers: current.stickers.map((sticker) => sticker.id === drag.id ? { ...sticker, x, y } : sticker) }));
  }

  function stopJournalStickerDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    journalStickerDragRef.current = null;
  }

  function removeJournalSticker(id: string) {
    setJournalDraft((current) => ({ ...current, stickers: current.stickers.filter((sticker) => sticker.id !== id) }));
    setSelectedJournalStickerId(null);
  }

  function deleteJournalEntry(id: string) {
    if (!window.confirm("要删除这页手账吗？删除后无法恢复。")) return;
    setJournalEntries((current) => {
      const next = current.filter((entry) => entry.id !== id);
      localStorage.setItem("mori-journal-entries", JSON.stringify(next));
      return next;
    });
    if (journalDraft.id === id) setJournalDraft(newJournalEntry());
    setToast("这页手账已删除");
  }

  function addGardenMoment(kind: GardenKind) {
    const moment: GardenMoment = { id: `garden-${Date.now()}`, kind, createdAt: Date.now() };
    setGardenMoments((current) => {
      const next = [moment, ...current];
      localStorage.setItem("mori-garden-moments", JSON.stringify(next));
      return next;
    });
    const option = GARDEN_OPTIONS.find((item) => item.kind === kind);
    setToast(option ? `${option.detail}。` : "花园记录好了。");
  }

  function removeGardenMoment(id: string) {
    setGardenMoments((current) => {
      const next = current.filter((item) => item.id !== id);
      localStorage.setItem("mori-garden-moments", JSON.stringify(next));
      return next;
    });
    setToast("这条花园记录已删除");
  }

  const weekStart = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const weeklyMoments = gardenMoments.filter((moment) => moment.createdAt >= weekStart);
  const weeklyConnectionCount = weeklyMoments.filter((moment) => moment.kind === "light").length;

  const activeLabel = STATES.find((item) => item.id === action)?.label ?? "发呆";
  const activeMood = MOODS[moodIndex];
  const connected = connectionStatus === "verified";
  const providerLabel = PROVIDERS.find((item) => item.id === config.provider)?.label ?? "自定义模型";

  return (
    <main className={`app-shell ${chatOpen ? "chat-is-open" : ""}`}>
      <header className="topbar">
        <button className="brand" onClick={cycleMood} aria-label="切换 MORI 的表情">
          <span className="brand-mark">M</span>
          <span><strong>MORI</strong><small>my quiet desktop companion</small></span>
        </button>
        <div className="status-pill"><span className="status-dot" />只属于你的安静角落</div>
        <nav className="top-actions" aria-label="MORI 工具">
          <button onClick={() => setMailOpen(true)}>树洞 <span>{letterDrafts.length}</span></button>
          <button onClick={() => setJournalOpen(true)}>MORI 手账</button>
          <button onClick={() => setGardenOpen(true)}>心理花园</button>
          <button className={connected ? "connected" : ""} onClick={() => { setDraftConfig(config); setSettingsOpen(true); }}>
            {connected ? "模型可用" : "连接模型"}
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
        <div className="ambient-light" aria-hidden="true"><i /><i /><i /><i /></div>
        <div className="mailbox-object" aria-hidden="true"><span>✉</span><i /></div>
        <button className="journal-object" onClick={() => setJournalOpen(true)} aria-label="打开 MORI 手账"><span>MY<br />LITTLE<br />JOURNAL</span><i>✿</i></button>

        <div
          className={`pet-wrap action-${action} mood-${activeMood.id} ${action === "walk" ? "is-walking" : ""} ${isDragging ? "is-dragging" : ""}`}
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
          <p>{ACTION_LINES[action][speechIndex % ACTION_LINES[action].length]}</p>
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
          <div><span className="mini-mori">M</span><p><strong>MORI</strong><small>{seriousMode ? "安全提示 · 不调用模型" : connected ? `已验证 · ${providerLabel} · ${config.model}` : connectionStatus === "configured" ? "已配置 · 尚未验证" : connectionStatus === "failed" ? "连接失败 · 请重新验证" : "本地演示模式"}</small></p></div>
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
                    <div><dt>发生了什么</dt><dd>最近面对每天的安排时会明显紧张和抗拒。</dd></div>
                    <div><dt>影响了什么</dt><dd>睡眠和正常生活节奏已经受到影响。</dd></div>
                    <div><dt>我需要什么</dt><dd>希望你先听完，并陪我寻找合适的支持。</dd></div>
                  </dl>
                  <div className="letter-actions"><button onClick={() => openLetterEditor("家人")}>整理成草稿</button><button onClick={() => openLetterEditor("专业人士")}>改成正式说明</button><button className="quiet" onClick={() => setToast("没关系，决定权一直在你手上")}>暂不发送</button></div>
                </article>
              )}
            </div>
          ))}
          {isThinking && <div className="typing"><span /><span /><span /> MORI 在整理</div>}
          <div ref={chatEndRef} />
        </div>
        <div className="quick-prompts">
          <button onClick={() => setInput("今天有件事没做好，我一直在反复想。")}>没做好以后一直在想</button>
          <button onClick={() => setInput("我不知道怎么告诉身边的人我最近状态不好。")}>不知道怎么开口</button>
        </div>
        <form className="composer" onSubmit={sendMessage}>
          <textarea value={input} onChange={(event) => setInput(event.target.value)} placeholder="乱七八糟地说也可以……" rows={3} aria-label="给 MORI 的消息" onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void sendMessage(); } }} />
          <div><span>Enter 发送 · Shift + Enter 换行</span><button type="submit" disabled={!input.trim() || isThinking}>发送</button></div>
        </form>
      </aside>

      {settingsOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSettingsOpen(false); }}>
          <form className="modal-card settings-card" onSubmit={saveAgentConfig}>
            <div className="modal-heading"><div><span className="eyebrow">MODEL SETTINGS</span><h2>连接你的大模型</h2></div><button type="button" onClick={() => setSettingsOpen(false)}>×</button></div>
            <label>接口类型<select value={draftConfig.provider} onChange={(event) => changeProvider(event.target.value as ModelProvider)}>{PROVIDERS.map((provider) => <option key={provider.id} value={provider.id}>{provider.label}</option>)}</select></label>
            <div className="field-grid">
              <label>模型名称<input required value={draftConfig.model} onChange={(event) => setDraftConfig({ ...draftConfig, model: event.target.value })} placeholder="输入服务商提供的模型 ID" /></label>
              <label>API 根地址<input required value={draftConfig.baseUrl} onChange={(event) => setDraftConfig({ ...draftConfig, baseUrl: event.target.value })} /></label>
            </div>
            <label>API Key（由服务商要求；无鉴权 HTTPS 服务可留空）<input required={draftConfig.provider !== "compatible"} type="password" value={draftConfig.apiKey} onChange={(event) => setDraftConfig({ ...draftConfig, apiKey: event.target.value })} placeholder={draftConfig.provider === "compatible" ? "无鉴权服务可留空" : "输入供应商 API Key"} autoComplete="off" /></label>
            <div className="privacy-box"><b>{PROVIDERS.find((item) => item.id === draftConfig.provider)?.hint}</b><p>保存时 MORI 会先发起一次真实 API 请求，只有成功才显示“模型可用”。支持 OpenAI、Anthropic、Gemini 与任何 OpenAI 兼容的 HTTPS 服务；线上版不能连接你电脑上的 localhost。配置仅保存在当前浏览器标签页；对话会发送给你选择的模型服务。</p></div>
            <div className="modal-actions"><button type="button" className="secondary" onClick={() => { setDraftConfig(DEFAULT_CONFIG); setConfig(DEFAULT_CONFIG); setConnectionStatus("demo"); sessionStorage.removeItem("mori-agent-config"); setSettingsOpen(false); }}>使用演示模式</button><button type="submit" disabled={isVerifyingConnection}>{isVerifyingConnection ? "正在验证…" : "验证并连接"}</button></div>
          </form>
        </div>
      )}

      {mailOpen && (
        <Drawer title="MORI 的树洞" subtitle="想说但还没准备好告诉任何人的话，可以先放在这里" onClose={() => setMailOpen(false)}>
          <div className="mail-intro"><span>{letterDrafts.length}</span><p>段只属于你的文字<br /><small>不会被自动发送给任何人</small></p></div>
          <section className="letter-starter" aria-label="写给树洞">
            <span>PRIVATE LITTLE NOTE</span><h3>先把想说的话写下来</h3><p>这里不是邮件，也没有收件人。你可以写得凌乱、简短，或者只留下一句。</p>
            <div className="recipient-picker"><button onClick={() => { setEditingLetter({ id: `letter-${Date.now()}`, recipient: "树洞", title: "今天想说的话", body: "", source: "" }); }}>写一段新的话</button>{LETTER_RECIPIENTS.filter((recipient) => recipient !== "树洞").map((recipient) => <button key={recipient} onClick={() => openLetterEditor(recipient)}>整理给{recipient}</button>)}</div>
          </section>
          {editingLetter && (
            <section className="letter-editor" aria-label="编辑信件草稿">
              <div className="letter-editor-heading"><div><span>正在编辑</span><h3>这封信由你决定</h3></div><button onClick={() => setEditingLetter(null)}>收起</button></div>
              <label>收信对象<select value={editingLetter.recipient} onChange={(event) => changeLetterRecipient(event.target.value as LetterRecipient)}>{LETTER_RECIPIENTS.map((recipient) => <option key={recipient} value={recipient}>{recipient}</option>)}</select></label>
              <label>标题<input value={editingLetter.title} onChange={(event) => setEditingLetter({ ...editingLetter, title: event.target.value })} /></label>
              <label>内容<textarea value={editingLetter.body} onChange={(event) => setEditingLetter({ ...editingLetter, body: event.target.value })} rows={10} /></label>
              <div className="letter-editor-actions"><button onClick={saveLetterDraft}>保存草稿</button><button className="secondary" onClick={() => copyLetter()}>复制</button><span>不会自动发送</span></div>
            </section>
          )}
          <section className="saved-letters" aria-label="已保存草稿">
            <div className="saved-letters-heading"><h3>已保存</h3><span>{letterDrafts.length} 封</span></div>
            {letterDrafts.length === 0 ? <p className="empty-letters">还没有保存的草稿。你可以从当前聊天开始整理。</p> : letterDrafts.map((draft) => (
              <article className="mail-item" key={draft.id}><div><span>{draft.recipient === "树洞" ? "树洞" : `给${draft.recipient}`}</span><time>{draft.savedAt ? new Date(draft.savedAt).toLocaleDateString("zh-CN") : "未保存"}</time></div><h3>{draft.title}</h3><p>{draft.body.slice(0, 64)}{draft.body.length > 64 ? "……" : ""}</p><div className="mail-item-actions"><button onClick={() => setEditingLetter(draft)}>打开并编辑</button><button onClick={() => copyLetter(draft)}>复制</button><button className="delete-draft" onClick={() => deleteLetterDraft(draft.id)}>删除</button></div></article>
            ))}
          </section>
          <div className="drawer-disclaimer">草稿只在你点击“保存草稿”后保存在当前设备的浏览器中；你可以随时复制或删除，MORI 不会代你发送。</div>
        </Drawer>
      )}

      {journalOpen && (
        <Drawer title="MORI 的彩色手账" subtitle="把想留下的文字、照片和小贴纸贴在这一页" onClose={() => setJournalOpen(false)} wide>
          <div className="journal-toolbar">
            <button type="button" onClick={() => { setJournalDraft(newJournalEntry()); setSelectedJournalStickerId(null); }}>＋ 新的一页</button>
            <span>{new Date(journalDraft.createdAt).toLocaleDateString("zh-CN", { month: "long", day: "numeric", weekday: "short" })}</span>
            <button type="button" className="journal-save" onClick={saveJournalEntry}>保存这一页</button>
          </div>
          <section ref={journalPageRef} className={`journal-page paper-${journalDraft.paper}`} aria-label="正在编辑的手账页" onPointerDown={() => setSelectedJournalStickerId(null)}>
            <div className="journal-tape tape-one" /><div className="journal-tape tape-two" />
            <div className="journal-page-heading"><input value={journalDraft.title} onChange={(event) => setJournalDraft({ ...journalDraft, title: event.target.value })} placeholder="给今天起一个标题" aria-label="手账标题" /><small>{new Date(journalDraft.createdAt).toLocaleDateString("zh-CN")}</small></div>
            <textarea value={journalDraft.body} onChange={(event) => setJournalDraft({ ...journalDraft, body: event.target.value })} placeholder="今天有什么想贴在这里的片刻？\n不需要写得完整，几个词、一段话都可以。" rows={7} aria-label="手账内容" />
            {journalDraft.photos.length > 0 && <div className="journal-photos">{journalDraft.photos.map((photo, index) => <figure key={photo}>
              {/* 用户本地导入的 data URL 不适用服务端图片优化。 */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo} alt={`手账照片 ${index + 1}`} />
              <button type="button" onClick={() => setJournalDraft((current) => ({ ...current, photos: current.photos.filter((item) => item !== photo) }))} aria-label={`移除第 ${index + 1} 张图片`}>×</button>
            </figure>)}</div>}
            <div className="journal-stickers" aria-label="已贴上的贴纸">{journalDraft.stickers.map((sticker) => <div key={sticker.id} className={`journal-sticker ${selectedJournalStickerId === sticker.id ? "selected" : ""}`} style={{ left: `${sticker.x}%`, top: `${sticker.y}%`, transform: `rotate(${sticker.rotation}deg)` }} role="button" tabIndex={0} aria-label={`贴纸：${sticker.symbol}，可拖动`} onPointerDown={(event) => startJournalStickerDrag(event, sticker)} onPointerMove={moveJournalSticker} onPointerUp={stopJournalStickerDrag} onPointerCancel={stopJournalStickerDrag} onKeyDown={(event) => { if (event.key === "Delete" || event.key === "Backspace") removeJournalSticker(sticker.id); }}><span>{sticker.symbol}</span>{selectedJournalStickerId === sticker.id && <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); removeJournalSticker(sticker.id); }} aria-label={`删除贴纸 ${sticker.symbol}`}>×</button>}</div>)}</div>
          </section>
          <section className="journal-supplies" aria-label="手账素材">
            <div className="journal-supplies-heading"><div><span>DECORATE THIS PAGE</span><h3>给这一页加一点颜色</h3></div><label className="image-import">导入图片<input type="file" accept="image/*" multiple onChange={importJournalImages} /></label></div>
            <div className="paper-picker" aria-label="选择纸张颜色">{JOURNAL_PAPERS.map((paper) => <button type="button" key={paper.id} className={journalDraft.paper === paper.id ? "active" : ""} onClick={() => setJournalDraft({ ...journalDraft, paper: paper.id })}><i className={`paper-swatch ${paper.id}`} />{paper.label}</button>)}</div>
            <div className="sticker-picker" aria-label="选择贴纸">{JOURNAL_STICKERS.map((sticker) => <button type="button" key={sticker.symbol} onClick={() => addJournalSticker(sticker.symbol)}><b>{sticker.symbol}</b><span>{sticker.label}</span></button>)}</div>
          </section>
          <section className="journal-history" aria-label="已保存手账"><div><h3>已经留下的页</h3><span>{journalEntries.length} 页</span></div>{journalEntries.length === 0 ? <p>还没有保存的手账。写好这一页后，点击“保存这一页”。</p> : <div className="journal-entry-list">{journalEntries.map((entry) => <article key={entry.id} className={`journal-entry-preview paper-${entry.paper}`}><button type="button" className="journal-entry-open" onClick={() => openJournalEntry(entry)}><small>{new Date(entry.updatedAt).toLocaleDateString("zh-CN")}</small><strong>{entry.title}</strong><p>{entry.body || "一页留白，也是一种记录。"}</p><span>{entry.stickers.slice(0, 4).map((sticker) => sticker.symbol).join(" ")}</span></button><button type="button" className="journal-entry-delete" onClick={() => deleteJournalEntry(entry.id)} aria-label={`删除手账：${entry.title}`}>×</button></article>)}</div>}</section>
          <div className="drawer-disclaimer">文字、贴纸和图片只会在你点击“保存这一页”后保存在这台设备的浏览器中。图片每张不超过 2MB，每页最多 4 张。</div>
        </Drawer>
      )}

      {gardenOpen && (
        <Drawer title="MORI 的心理花园" subtitle="每一种经历都能成为一部分风景" onClose={() => setGardenOpen(false)} wide>
          <section className="garden-journal-heading"><span>GROW A LITTLE TODAY</span><h3>把今天的颜色，留在花园这一页。</h3><p>像手账一样选一片心情、一点勇敢，慢慢让它们长成风景。</p></section>
          <div className="garden-scene" aria-label="你的心理花园">
            <div className="garden-sky"><span className="garden-sun" /><i className="garden-cloud one" /><i className="garden-cloud two" /></div>
            <div className="garden-ground"><i className="flower f1" /><i className="flower f2" /><i className="flower f3" /><i className="light l1" /><i className="light l2" /><i className="light l3" /></div>
            <div className="garden-moments" aria-hidden="true">{gardenMoments.slice(0, 18).map((moment, index) => { const option = GARDEN_OPTIONS.find((item) => item.kind === moment.kind); return <span key={moment.id} className={`garden-token ${moment.kind}`} style={{ left: `${12 + (index * 19) % 76}%`, top: `${38 + (index * 23) % 48}%` }}>{option?.symbol}</span>; })}</div>
          </div>
          <section className="garden-picker"><h3>今天想在花园里留下什么？</h3><p>这不是打分，也不需要每天记录。只在你想留下一个片刻时添加。</p><div>{GARDEN_OPTIONS.map((option) => <button key={option.kind} onClick={() => addGardenMoment(option.kind)}><b>{option.symbol}</b><span>{option.label}<small>{option.detail}</small></span></button>)}</div></section>
          <article className="wrapped-card"><span>THIS WEEK WITH MORI</span><h3>{weeklyMoments.length ? `这周，你在花园里留下了 ${weeklyMoments.length} 个片刻。` : "这周还没有记录，也完全没关系。"}</h3><ul>{weeklyMoments.length ? <><li>你允许自己把一些感受和经历留在这里，而不是急着把它们变成分数。</li>{weeklyConnectionCount > 0 && <li>远处亮起了 {weeklyConnectionCount} 盏灯——代表你主动选择了一次现实连接。</li>}<li>想继续时，只需要从一个很小的动作开始。</li></> : <li>当你准备好时，可以记录一次散步、一次勇敢表达，或只是此刻的感受。</li>}</ul></article>
          {gardenMoments.length > 0 && <section className="garden-history"><div><h3>最近留下的片刻</h3><span>{gardenMoments.length} 条</span></div>{gardenMoments.slice(0, 6).map((moment) => { const option = GARDEN_OPTIONS.find((item) => item.kind === moment.kind); return <article key={moment.id}><b>{option?.symbol}</b><span>{option?.label}<small>{new Date(moment.createdAt).toLocaleDateString("zh-CN")}</small></span><button onClick={() => removeGardenMoment(moment.id)}>删除</button></article>; })}</section>}
          <div className="drawer-disclaimer">花园记录只保存在当前设备浏览器。它描述变化与连接，不代表健康评估、情绪分数或诊断。</div>
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
            <div className="serious-guidance"><p><b>现在尽量不要独处。</b>去有人的安全地点，请一位可信任的人马上到场或保持通话；如果能安全做到，远离可能造成伤害的物品和地点。</p><p>MORI 不能替你拨号、定位、报警或通知任何人。这不是实时人工值守渠道。12356 不能替代正在发生的医疗或人身危险中的 120 / 110。</p></div>
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

function Drawer({ title, subtitle, onClose, children, wide = false }: { title: string; subtitle: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="drawer-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <aside className={`drawer ${wide ? "drawer-wide" : ""}`}>
        <div className="drawer-heading"><div><h2>{title}</h2><p>{subtitle}</p></div><button onClick={onClose} aria-label="关闭">×</button></div>
        <div className="drawer-content">{children}</div>
      </aside>
    </div>
  );
}
