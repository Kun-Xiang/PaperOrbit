"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

declare global {
  interface Window {
    openai?: {
      sendFollowUpMessage?: (args: {
        prompt: string;
        title?: string;
      }) => Promise<void>;
    };
  }
}

type View = "today" | "discover" | "library" | "reports";

type Paper = {
  id: string;
  title: string;
  authors: string[];
  summary: string;
  zhSummary?: string;
  published: string;
  category: string;
  categories?: string[];
  score: number;
  minutes: number;
  url: string;
  pdfUrl: string;
  tags: string[];
  recommendation?: {
    reason: string;
    matchedInterests: string[];
    signals: {
      relevance: number;
      affinity: number;
      freshness: number;
      influence: number;
      evidence: number;
    };
    citationCount?: number;
    influentialCitationCount?: number;
    exploration?: boolean;
  };
};

type AffinityProfile = Record<string, number>;

export type PaperOrbitViewer = {
  displayName: string;
  email: string;
  initials: string;
  role: "owner" | "manager";
};

type ChatMessage = {
  role: "user" | "assistant";
  text: string;
};

type ReadingReport = {
  id: string;
  paperId: string;
  paperTitle: string;
  content: string;
  createdAt: string;
  mode: "openai" | "preview";
};

const DEFAULT_INTERESTS = [
  "Physical AI",
  "Multimodal Reasoning",
  "Embodied Intelligence",
];

const DAILY_PAPER_COUNT = 10;

const INTEREST_OPTIONS = [
  "Physical AI",
  "Multimodal Reasoning",
  "Embodied Intelligence",
  "World Models",
  "AI for Science",
  "Vision-Language Models",
  "Robot Learning",
  "Mechanistic Interpretability",
];

const SEED_PAPERS: Paper[] = [
  {
    id: "2607.08639",
    title: "Native Video-Action Pretraining for Generalizable Robot Control",
    authors: ["Qihang Zhang", "Lin Li", "Luyao Zhang", "Shuailei Ma"],
    summary:
      "LingBot-VA 2.0 builds a video-action foundation model natively for embodied control, combining causal pretraining, semantic action tokens, sparse experts, and real-time asynchronous execution.",
    zhSummary:
      "从预训练阶段就把视觉、动作与因果动态放进同一语义空间，让机器人控制摆脱“先做视频模型、再勉强改造”的路径。",
    published: "2026-07-09",
    category: "cs.RO",
    categories: ["cs.RO", "cs.CV", "cs.AI"],
    score: 96,
    minutes: 24,
    url: "https://arxiv.org/abs/2607.08639",
    pdfUrl: "https://arxiv.org/pdf/2607.08639",
    tags: ["Robot Learning", "Video-Action", "World Models"],
  },
  {
    id: "2607.09024",
    title: "Video Generation Models are General-Purpose Vision Learners",
    authors: ["Letian Wang", "Chuhan Zhang", "Rishabh Kabra", "Kaiming He"],
    summary:
      "GenCeption turns a pretrained text-to-video diffusion backbone into a feed-forward perception model for depth, segmentation, pose, and 3D keypoint tasks.",
    zhSummary:
      "把视频生成模型重新解释为通用视觉预训练器：同一骨干可被文本指令驱动，完成深度、分割、姿态与三维关键点等任务。",
    published: "2026-07-10",
    category: "cs.CV",
    categories: ["cs.CV", "cs.AI"],
    score: 93,
    minutes: 18,
    url: "https://arxiv.org/abs/2607.09024",
    pdfUrl: "https://arxiv.org/pdf/2607.09024",
    tags: ["Video Models", "Generalist Vision", "Multimodal"],
  },
  {
    id: "2607.09657",
    title: "Scalable Visual Pretraining for Language Intelligence",
    authors: ["Yiming Zhang", "Zhonghan Zhao", "Wenwei Zhang", "Kai Chen"],
    summary:
      "The work studies visual pretraining directly on scientific documents and web pages, retaining equations, figures, and layout instead of reducing them to plain text.",
    zhSummary:
      "直接从带公式、图表和版式的视觉文档学习语言智能，在相同语料上持续优于纯文本预训练。",
    published: "2026-07-10",
    category: "cs.CL",
    categories: ["cs.CL", "cs.CV", "cs.LG"],
    score: 91,
    minutes: 16,
    url: "https://arxiv.org/abs/2607.09657",
    pdfUrl: "https://arxiv.org/pdf/2607.09657",
    tags: ["Visual Documents", "Pretraining", "AI for Science"],
  },
  {
    id: "2607.07675",
    title: "Scaling Mixture-of-Experts Video Pretraining for Embodied Intelligence",
    authors: ["Shuailei Ma", "Jiaqi Liao", "Xinyang Wang"],
    summary:
      "LingBot-Video scales open video foundation models with sparse experts, robot-augmented data, and physics-aware rewards for embodied intelligence.",
    zhSummary:
      "用稀疏专家、机器人增强数据与物理一致性奖励扩展视频预训练，为具身智能提供更可信的动态先验。",
    published: "2026-07-08",
    category: "cs.CV",
    categories: ["cs.CV", "cs.RO"],
    score: 89,
    minutes: 21,
    url: "https://arxiv.org/abs/2607.07675",
    pdfUrl: "https://arxiv.org/pdf/2607.07675",
    tags: ["Mixture of Experts", "Embodied AI", "Video Pretraining"],
  },
  {
    id: "2607.09661",
    title: "PanoWorld: Real-World Panoramic Generation",
    authors: ["Haoyuan Li", "Dizhe Zhang", "Yuemei Zhou", "Ming-Hsuan Yang"],
    summary:
      "PanoWorld uses panoramic representations and geometry-aware memory to preserve physical consistency across long camera trajectories and illumination changes.",
    zhSummary:
      "用全景表示和几何记忆处理超长相机轨迹，在大尺度空间变化中保持场景连续性与物理一致性。",
    published: "2026-07-10",
    category: "cs.CV",
    categories: ["cs.CV", "cs.GR"],
    score: 86,
    minutes: 14,
    url: "https://arxiv.org/abs/2607.09661",
    pdfUrl: "https://arxiv.org/pdf/2607.09661",
    tags: ["World Models", "3D Vision", "Generation"],
  },
  {
    id: "2607.09655",
    title: "OpenLongTail: Generative Scaling of Long-Tail Driving Data",
    authors: ["Lulin Liu", "Nuo Chen", "Yan Wang", "Bangya Liu", "Wenyan Cong", "Marco Pavone"],
    summary:
      "OpenLongTail is an open-source generative data engine that converts heterogeneous in-the-wild driving videos into view-aligned, temporally coherent multi-view assets for long-tail policy learning.",
    zhSummary:
      "把异构的真实长尾驾驶视频补全为视角对齐、时序一致的多视图训练数据，并在闭环测试中验证其对极端场景鲁棒性的提升。",
    published: "2026-07-10",
    category: "cs.CV",
    categories: ["cs.CV"],
    score: 90,
    minutes: 20,
    url: "https://arxiv.org/abs/2607.09655",
    pdfUrl: "https://arxiv.org/pdf/2607.09655",
    tags: ["Autonomous Driving", "Generative Data", "Embodied AI"],
  },
  {
    id: "2607.09648",
    title: "B-spline Policy: Accelerating Manipulation Policies via B-spline Action Representations",
    authors: ["Xiaoshen Han", "Haoyu Xiong", "Haonan Chen", "Chaoqi Liu", "Antonio Torralba", "Yuke Zhu", "Yilun Du"],
    summary:
      "B-spline Policy replaces discrete action chunks with continuous B-spline curves, allowing robot policies to execute smoother trajectories at higher frequencies and speeds.",
    zhSummary:
      "用连续 B 样条曲线替代离散动作块，让操作策略生成可缩放的平滑轨迹，在保持成功率的同时缩短任务完成时间。",
    published: "2026-07-10",
    category: "cs.RO",
    categories: ["cs.RO"],
    score: 92,
    minutes: 17,
    url: "https://arxiv.org/abs/2607.09648",
    pdfUrl: "https://arxiv.org/pdf/2607.09648",
    tags: ["Robot Learning", "Manipulation", "Action Representation"],
  },
  {
    id: "2607.09629",
    title: "4DR360: State Reasoning for Joint 3D Detection and Occupancy Prediction",
    authors: ["Xiaokai Bai", "Lianqing Zheng", "Runwei Guan", "Songkai Wang", "Siyuan Cao", "Hui-liang Shen"],
    summary:
      "4DR360 treats semantic occupancy as a persistent scene state and propagates it through radar-camera fusion stages for joint 3D detection and occupancy prediction.",
    zhSummary:
      "将语义占用建模为持续传播的场景状态，把 4D 雷达与相机信息用于统一的三维检测和占用预测，并覆盖鲁棒性与效率评估。",
    published: "2026-07-10",
    category: "cs.CV",
    categories: ["cs.CV", "cs.AI"],
    score: 87,
    minutes: 19,
    url: "https://arxiv.org/abs/2607.09629",
    pdfUrl: "https://arxiv.org/pdf/2607.09629",
    tags: ["Autonomous Driving", "3D Perception", "Multimodal"],
  },
  {
    id: "2607.09590",
    title: "PAC-ACT: Post-training Actor-Critic for Action Chunking Transformers",
    authors: ["Yujie Pang", "Zudong Li"],
    summary:
      "PAC-ACT adds chunk-level reinforcement-learning post-training to pretrained Action Chunking Transformers for precision contact manipulation under pose and force constraints.",
    zhSummary:
      "在预训练 ACT 策略上进行动作块级 actor-critic 后训练，用行为先验约束缓解接触操作中的分布偏移，同时保持低延迟。",
    published: "2026-07-10",
    category: "cs.RO",
    categories: ["cs.RO", "cs.AI"],
    score: 91,
    minutes: 18,
    url: "https://arxiv.org/abs/2607.09590",
    pdfUrl: "https://arxiv.org/pdf/2607.09590",
    tags: ["Robot Learning", "Actor-Critic", "Contact-Rich Manipulation"],
  },
  {
    id: "2607.09587",
    title: "CoDiMAD: Diffusion-Based Privileged Distillation for Communication-Free Multi-Robot Coordination",
    authors: ["Jiyue Tao", "Shunheng Xin", "Tongsheng Shen", "Dexin Zhao", "Feitian Zhang"],
    summary:
      "CoDiMAD distills a globally informed multi-robot oracle into decentralized diffusion policies that preserve multimodal cooperative actions under partial observability.",
    zhSummary:
      "将全局信息 oracle 蒸馏为去中心化扩散策略，避免确定性蒸馏把多模态协作动作平均掉，面向无通信、多机器人协同。",
    published: "2026-07-10",
    category: "cs.RO",
    categories: ["cs.RO"],
    score: 89,
    minutes: 21,
    url: "https://arxiv.org/abs/2607.09587",
    pdfUrl: "https://arxiv.org/pdf/2607.09587",
    tags: ["Multi-Robot", "Diffusion Policy", "Embodied AI"],
  },
];

const STORAGE = {
  saved: "paper-orbit:saved",
  read: "paper-orbit:read",
  reports: "paper-orbit:reports",
  interests: "paper-orbit:interests",
  affinity: "paper-orbit:affinity-v2",
  refresh: "paper-orbit:last-refresh-v2",
};

function uniquePapers(...groups: Paper[][]) {
  const map = new Map<string, Paper>();
  groups.flat().forEach((paper) => map.set(paper.id, paper));
  return Array.from(map.values());
}

function dateLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    month: "short",
    day: "numeric",
  }).format(date);
}

function safeParse<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export default function PaperOrbitClient({
  viewer,
}: {
  viewer: PaperOrbitViewer;
}) {
  const [activeView, setActiveView] = useState<View>("today");
  const [feed, setFeed] = useState<Paper[]>(SEED_PAPERS);
  const [searchResults, setSearchResults] = useState<Paper[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchMessage, setSearchMessage] = useState("搜索标题、作者、主题或 arXiv ID");
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [reports, setReports] = useState<ReadingReport[]>([]);
  const [interests, setInterests] = useState(DEFAULT_INTERESTS);
  const [affinity, setAffinity] = useState<AffinityProfile>({});
  const [draftInterests, setDraftInterests] = useState(DEFAULT_INTERESTS);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshNote, setRefreshNote] = useState("多信号选刊 · 每日更新");
  const [copilotPaperId, setCopilotPaperId] = useState(SEED_PAPERS[0].id);
  const [aiInput, setAiInput] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiMode, setAiMode] = useState<"openai" | "preview">("preview");
  const [chat, setChat] = useState<ChatMessage[]>([
    {
      role: "assistant",
      text: "选一篇论文，然后问我它的核心贡献、方法差异、关键公式或复现风险。",
    },
  ]);
  const [activeReport, setActiveReport] = useState<ReadingReport | null>(null);
  const [toast, setToast] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  const allPapers = useMemo(
    () => uniquePapers(feed, searchResults, SEED_PAPERS),
    [feed, searchResults],
  );
  const copilotPaper =
    allPapers.find((paper) => paper.id === copilotPaperId) ?? feed[0];
  const libraryPapers = allPapers.filter((paper) => savedIds.has(paper.id));

  useEffect(() => {
    setSavedIds(new Set(safeParse<string[]>(localStorage.getItem(STORAGE.saved), [])));
    setReadIds(new Set(safeParse<string[]>(localStorage.getItem(STORAGE.read), [])));
    setReports(
      safeParse<ReadingReport[]>(localStorage.getItem(STORAGE.reports), []),
    );
    const storedInterests = safeParse<string[]>(
      localStorage.getItem(STORAGE.interests),
      DEFAULT_INTERESTS,
    );
    const storedAffinity = safeParse<AffinityProfile>(
      localStorage.getItem(STORAGE.affinity),
      {},
    );
    setInterests(storedInterests);
    setAffinity(storedAffinity);
    setDraftInterests(storedInterests);
    setReady(true);

    const today = new Date().toISOString().slice(0, 10);
    if (localStorage.getItem(STORAGE.refresh) !== today) {
      void refreshDaily(storedInterests, true, storedAffinity);
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(STORAGE.saved, JSON.stringify(Array.from(savedIds)));
  }, [ready, savedIds]);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(STORAGE.read, JSON.stringify(Array.from(readIds)));
  }, [ready, readIds]);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(STORAGE.reports, JSON.stringify(reports));
  }, [ready, reports]);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(STORAGE.affinity, JSON.stringify(affinity));
  }, [ready, affinity]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
      }
      if (event.key === "Escape") {
        setSettingsOpen(false);
        setActiveReport(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2400);
    return () => window.clearTimeout(timer);
  }, [toast]);

  async function refreshDaily(
    nextInterests = interests,
    silent = false,
    nextAffinity = affinity,
  ) {
    setRefreshing(true);
    if (!silent) setRefreshNote("正在扫描候选池并重新排序…");
    try {
      const affinityTerms = Object.entries(nextAffinity)
        .sort(([, left], [, right]) => right - left)
        .slice(0, 10)
        .map(([term]) => term);
      const params = new URLSearchParams({
        mode: "feed",
        interests: nextInterests.join(","),
      });
      if (affinityTerms.length) params.set("profile", affinityTerms.join("|"));
      const response = await fetch(`/api/arxiv?${params.toString()}`);
      if (!response.ok) throw new Error("feed unavailable");
      const data = (await response.json()) as {
        papers?: Paper[];
        source?: string;
        meta?: { candidateCount?: number; rankingVersion?: string };
      };
      if (data.papers && data.papers.length >= 3) {
        const nextFeed = uniquePapers(data.papers, SEED_PAPERS).slice(
          0,
          DAILY_PAPER_COUNT,
        );
        setFeed(nextFeed);
        localStorage.setItem(
          STORAGE.refresh,
          new Date().toISOString().slice(0, 10),
        );
        const candidateCount = data.meta?.candidateCount ?? data.papers.length;
        const sourceLabel = data.source?.includes("semantic-scholar")
          ? "影响力信号已校准"
          : "arXiv 多信号排序";
        setRefreshNote(`从 ${candidateCount} 篇候选中精选 · ${sourceLabel}`);
        if (!silent) setToast("今日 10 篇选刊已重新排序");
      }
    } catch {
      setRefreshNote("编辑部缓存 · 网络恢复后自动更新");
    } finally {
      setRefreshing(false);
    }
  }

  function learnFromPaper(paper: Paper, weight: number) {
    const signals = Array.from(
      new Set([paper.category, ...(paper.categories ?? []), ...paper.tags]),
    ).filter(Boolean);
    setAffinity((current) => {
      const next = { ...current };
      for (const signal of signals) {
        const value = Math.max(0, Math.min(12, (next[signal] ?? 0) + weight));
        if (value <= 0.05) delete next[signal];
        else next[signal] = Number(value.toFixed(2));
      }
      return next;
    });
  }

  async function submitSearch(event?: FormEvent, queryOverride?: string) {
    event?.preventDefault();
    const query = (queryOverride ?? searchQuery).trim();
    if (!query) {
      searchRef.current?.focus();
      return;
    }
    setActiveView("discover");
    setSearchLoading(true);
    setSearchMessage(`正在 arXiv 中检索“${query}”…`);
    try {
      const response = await fetch(`/api/arxiv?q=${encodeURIComponent(query)}`);
      if (!response.ok) throw new Error("search unavailable");
      const data = (await response.json()) as { papers?: Paper[] };
      const papers = data.papers ?? [];
      setSearchResults(papers);
      setSearchMessage(
        papers.length ? `找到 ${papers.length} 篇最新结果` : "没有找到结果，试试更宽的关键词",
      );
    } catch {
      const local = SEED_PAPERS.filter((paper) =>
        `${paper.title} ${paper.summary} ${paper.tags.join(" ")}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      );
      setSearchResults(local);
      setSearchMessage(
        local.length ? "实时搜索暂不可用，先显示编辑部缓存" : "实时搜索暂不可用，请稍后重试",
      );
    } finally {
      setSearchLoading(false);
    }
  }

  function toggleSaved(id: string) {
    const paper = allPapers.find((item) => item.id === id);
    const wasSaved = savedIds.has(id);
    setSavedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
        setToast("已从书库移除");
      } else {
        next.add(id);
        setToast("已保存到书库");
      }
      return next;
    });
    if (paper) learnFromPaper(paper, wasSaved ? -0.6 : 1);
  }

  function startReading(paper: Paper) {
    if (!readIds.has(paper.id)) learnFromPaper(paper, 1.5);
    setReadIds((current) => new Set(current).add(paper.id));
    window.open(paper.url, "_blank", "noopener,noreferrer");
  }

  async function askAI(question?: string) {
    const prompt = (question ?? aiInput).trim();
    if (!prompt || !copilotPaper || aiBusy) return;
    setAiInput("");
    setChat((current) => [...current, { role: "user", text: prompt }]);
    setAiBusy(true);
    try {
      const response = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paper: copilotPaper, prompt, action: "chat" }),
      });
      if (!response.ok) throw new Error("ai unavailable");
      const data = (await response.json()) as {
        answer: string;
        mode: "openai" | "preview";
      };
      setAiMode(data.mode);
      setChat((current) => [
        ...current,
        { role: "assistant", text: data.answer },
      ]);
    } catch {
      setChat((current) => [
        ...current,
        {
          role: "assistant",
          text: "这次分析没有完成。你可以稍后重试，或点击“交给 Codex 深挖”继续讨论。",
        },
      ]);
    } finally {
      setAiBusy(false);
    }
  }

  async function generateReport(paper: Paper) {
    if (aiBusy) return;
    setCopilotPaperId(paper.id);
    setAiBusy(true);
    setToast("正在生成阅读报告…");
    try {
      const response = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paper,
          action: "report",
          prompt:
            "生成结构化中文阅读报告：研究问题、核心方法、关键贡献、证据强弱、局限、与我兴趣的关系、三个追问。",
        }),
      });
      if (!response.ok) throw new Error("report unavailable");
      const data = (await response.json()) as {
        answer: string;
        mode: "openai" | "preview";
      };
      const report: ReadingReport = {
        id: `${paper.id}-${Date.now()}`,
        paperId: paper.id,
        paperTitle: paper.title,
        content: data.answer,
        createdAt: new Date().toISOString(),
        mode: data.mode,
      };
      setReports((current) => [report, ...current]);
      setActiveReport(report);
      learnFromPaper(paper, 2);
      setReadIds((current) => new Set(current).add(paper.id));
      setToast("阅读报告已生成并保存");
    } catch {
      setToast("报告暂未生成，请稍后重试");
    } finally {
      setAiBusy(false);
    }
  }

  async function sendToCodex() {
    if (!copilotPaper) return;
    const prompt = `请深度分析论文《${copilotPaper.title}》（arXiv:${copilotPaper.id}）。我的研究兴趣是 ${interests.join("、")}。请重点解释它的核心机制、关键证据、与相关工作的差异，以及最值得复现的实验。`;
    if (window.openai?.sendFollowUpMessage) {
      await window.openai.sendFollowUpMessage({
        prompt,
        title: "让 Codex 深挖这篇论文",
      });
      return;
    }
    await askAI("请做一次更深入的机制分析，并给出可验证的复现清单。");
  }

  function saveInterests() {
    const next = draftInterests.length ? draftInterests : DEFAULT_INTERESTS;
    setInterests(next);
    localStorage.setItem(STORAGE.interests, JSON.stringify(next));
    setSettingsOpen(false);
    setToast("兴趣画像已更新");
    void refreshDaily(next);
  }

  function toggleDraftInterest(interest: string) {
    setDraftInterests((current) =>
      current.includes(interest)
        ? current.filter((item) => item !== interest)
        : [...current, interest],
    );
  }

  function downloadReport(report: ReadingReport) {
    const blob = new Blob(
      [`# ${report.paperTitle}\n\n${report.content}\n\n— Paper Orbit`],
      { type: "text/markdown;charset=utf-8" },
    );
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${report.paperId}-reading-report.md`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const navItems: Array<{ id: View; label: string; count?: number }> = [
    { id: "today", label: "Today" },
    { id: "discover", label: "Discover" },
    { id: "library", label: "Library", count: savedIds.size },
    { id: "reports", label: "Reports", count: reports.length },
  ];

  return (
    <div className="site-shell">
      <header className="topbar">
        <button
          className="brand"
          type="button"
          onClick={() => setActiveView("today")}
          aria-label="Paper Orbit 首页"
        >
          <span className="orbit-mark" aria-hidden="true">
            <span className="orbit-core" />
            <span className="orbit-planet" />
          </span>
          <span>
            <strong>Paper Orbit</strong>
            <small>Daily research edition</small>
          </span>
        </button>

        <nav className="main-nav" aria-label="主要导航">
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={activeView === item.id ? "active" : ""}
              onClick={() => setActiveView(item.id)}
            >
              {item.label}
              {typeof item.count === "number" && item.count > 0 ? (
                <span>{item.count}</span>
              ) : null}
            </button>
          ))}
        </nav>

        <div className="top-actions">
          <form className="search-compact" onSubmit={submitSearch}>
            <span className="search-glyph" aria-hidden="true" />
            <label className="sr-only" htmlFor="global-search">
              搜索 arXiv
            </label>
            <input
              ref={searchRef}
              id="global-search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="搜索 arXiv…"
              autoComplete="off"
            />
            <kbd>⌘ K</kbd>
          </form>
          <button
            className="profile-button"
            type="button"
            onClick={() => {
              setDraftInterests(interests);
              setSettingsOpen(true);
            }}
            aria-label={`编辑兴趣画像，当前用户 ${viewer.displayName}`}
            title={`${viewer.email} · ${viewer.role === "owner" ? "OWNER" : "MANAGER"}`}
          >
            {viewer.initials}
          </button>
        </div>
      </header>

      <main>
        {activeView === "today" ? (
          <TodayView
            feed={feed}
            interests={interests}
            refreshing={refreshing}
            refreshNote={refreshNote}
            savedIds={savedIds}
            readIds={readIds}
            reports={reports}
            copilotPaper={copilotPaper}
            copilotPaperId={copilotPaperId}
            allPapers={allPapers}
            chat={chat}
            aiInput={aiInput}
            aiBusy={aiBusy}
            aiMode={aiMode}
            onRefresh={() => void refreshDaily()}
            onToggleSaved={toggleSaved}
            onStartReading={startReading}
            onGenerateReport={(paper) => void generateReport(paper)}
            onSelectCopilotPaper={setCopilotPaperId}
            onAiInput={setAiInput}
            onAskAi={(question) => void askAI(question)}
            onSendToCodex={() => void sendToCodex()}
          />
        ) : null}

        {activeView === "discover" ? (
          <CollectionView
            eyebrow="DISCOVER / ARXIV INDEX"
            title="从整个 arXiv 发现下一篇"
            description={searchMessage}
            papers={searchResults}
            emptyLabel="在上方搜索框输入主题、作者或 arXiv ID。也可以从 Physical AI、world models、visual reasoning 开始。"
            savedIds={savedIds}
            readIds={readIds}
            loading={searchLoading}
            onToggleSaved={toggleSaved}
            onStartReading={startReading}
            onGenerateReport={(paper) => void generateReport(paper)}
            onUseSuggestion={(query) => {
              setSearchQuery(query);
              void submitSearch(undefined, query);
            }}
          />
        ) : null}

        {activeView === "library" ? (
          <CollectionView
            eyebrow="LIBRARY / PERSONAL ARCHIVE"
            title="你的论文书库"
            description={`${savedIds.size} 篇已保存 · ${readIds.size} 篇已开始阅读`}
            papers={libraryPapers}
            emptyLabel="还没有保存论文。回到 Today，点击“保存”建立你的第一组阅读队列。"
            savedIds={savedIds}
            readIds={readIds}
            onToggleSaved={toggleSaved}
            onStartReading={startReading}
            onGenerateReport={(paper) => void generateReport(paper)}
          />
        ) : null}

        {activeView === "reports" ? (
          <ReportsView
            reports={reports}
            onOpen={setActiveReport}
            onDownload={downloadReport}
            onGoToday={() => setActiveView("today")}
          />
        ) : null}
      </main>

      {settingsOpen ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setSettingsOpen(false)}>
          <section
            className="modal-sheet interests-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="interest-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button className="modal-close" type="button" onClick={() => setSettingsOpen(false)} aria-label="关闭">
              ×
            </button>
            <p className="eyebrow">PERSONAL EDITOR</p>
            <h2 id="interest-title">定义你的研究轨道</h2>
            <p>
              每天从扩展候选池中精选 10 篇；兴趣决定主轨道，保存、开始阅读和生成报告会持续校准排序。选择 2–5 个方向通常最有效。
            </p>
            <div className="viewer-card">
              <span aria-hidden="true">{viewer.initials}</span>
              <div>
                <strong>{viewer.displayName}</strong>
                <small>{viewer.email}</small>
              </div>
              <b>{viewer.role === "owner" ? "OWNER" : "MANAGER"}</b>
              <a href="/signout-with-chatgpt?return_to=%2F">切换账号</a>
            </div>
            <div className="interest-grid">
              {INTEREST_OPTIONS.map((interest) => (
                <button
                  key={interest}
                  type="button"
                  className={draftInterests.includes(interest) ? "selected" : ""}
                  aria-pressed={draftInterests.includes(interest)}
                  onClick={() => toggleDraftInterest(interest)}
                >
                  {draftInterests.includes(interest) ? "✓ " : "+ "}
                  {interest}
                </button>
              ))}
            </div>
            <div className="modal-actions">
              <button className="text-button" type="button" onClick={() => setSettingsOpen(false)}>
                取消
              </button>
              <button className="primary-button" type="button" onClick={saveInterests}>
                保存并刷新选刊
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {activeReport ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setActiveReport(null)}>
          <article
            className="modal-sheet report-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="report-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button className="modal-close" type="button" onClick={() => setActiveReport(null)} aria-label="关闭">
              ×
            </button>
            <p className="eyebrow">READING REPORT / {activeReport.paperId}</p>
            <h2 id="report-title">{activeReport.paperTitle}</h2>
            <div className="report-meta">
              {new Date(activeReport.createdAt).toLocaleString("zh-CN")} · {activeReport.mode === "openai" ? "OpenAI 深度分析" : "摘要辅助模式"}
            </div>
            <div className="report-content">{activeReport.content}</div>
            <div className="modal-actions">
              <button className="text-button" type="button" onClick={() => navigator.clipboard.writeText(activeReport.content)}>
                复制正文
              </button>
              <button className="primary-button" type="button" onClick={() => downloadReport(activeReport)}>
                下载 Markdown
              </button>
            </div>
          </article>
        </div>
      ) : null}

      <div className={`toast ${toast ? "visible" : ""}`} role="status" aria-live="polite">
        {toast}
      </div>
    </div>
  );
}

type PaperEntryProps = {
  paper: Paper;
  index: number;
  featured?: boolean;
  saved: boolean;
  reading: boolean;
  onToggleSaved: (id: string) => void;
  onStartReading: (paper: Paper) => void;
  onGenerateReport: (paper: Paper) => void;
};

function PaperEntry({
  paper,
  index,
  featured = false,
  saved,
  reading,
  onToggleSaved,
  onStartReading,
  onGenerateReport,
}: PaperEntryProps) {
  return (
    <article className={`paper-entry ${featured ? "featured" : ""}`}>
      <div className="paper-number" aria-hidden="true">
        <span>{String(index + 1).padStart(2, "0")}</span>
        <i />
      </div>
      <div className="paper-copy">
        <div className="paper-kicker">
          <span>{paper.category}</span>
          <span>{dateLabel(paper.published)}</span>
          {paper.tags.slice(0, featured ? 3 : 2).map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>
        <h3>
          <a href={paper.url} target="_blank" rel="noreferrer">
            {paper.title}
          </a>
        </h3>
        <p>{paper.zhSummary ?? paper.summary}</p>
        <div className="paper-byline">
          {paper.authors.slice(0, 4).join(" · ")}
          {paper.authors.length > 4 ? " et al." : ""}
        </div>
      </div>
      <div className="paper-metrics">
        <div className="score-block">
          <span>ORBIT SCORE</span>
          <strong>{paper.score}</strong>
          <div className="score-line" aria-label={`推荐分 ${paper.score} 分`}>
            <i style={{ width: `${paper.score}%` }} />
          </div>
          <small className="score-reason">
            {paper.recommendation?.reason ?? "兴趣、时效与研究信号综合排序"}
          </small>
        </div>
        <span className="read-time">预计 {paper.minutes} 分钟</span>
        <div className="paper-actions">
          <button
            className={`save-button ${saved ? "saved" : ""}`}
            type="button"
            aria-pressed={saved}
            onClick={() => onToggleSaved(paper.id)}
          >
            {saved ? "✓ 已保存" : "+ 保存"}
          </button>
          <button className="report-button" type="button" onClick={() => onGenerateReport(paper)}>
            生成报告
          </button>
          <button className="read-button" type="button" onClick={() => onStartReading(paper)}>
            {reading ? "继续阅读 ↗" : "开始阅读 ↗"}
          </button>
        </div>
      </div>
    </article>
  );
}

type TodayViewProps = {
  feed: Paper[];
  interests: string[];
  refreshing: boolean;
  refreshNote: string;
  savedIds: Set<string>;
  readIds: Set<string>;
  reports: ReadingReport[];
  copilotPaper: Paper;
  copilotPaperId: string;
  allPapers: Paper[];
  chat: ChatMessage[];
  aiInput: string;
  aiBusy: boolean;
  aiMode: "openai" | "preview";
  onRefresh: () => void;
  onToggleSaved: (id: string) => void;
  onStartReading: (paper: Paper) => void;
  onGenerateReport: (paper: Paper) => void;
  onSelectCopilotPaper: (id: string) => void;
  onAiInput: (value: string) => void;
  onAskAi: (question?: string) => void;
  onSendToCodex: () => void;
};

function TodayView(props: TodayViewProps) {
  const completedThisWeek = Math.min(props.readIds.size, 10);
  const progress = Math.min(100, Math.max(10, completedThisWeek * 10));
  const quickPrompts = ["用三句话解释核心贡献", "和同领域代表工作比较", "指出最值得复现的实验"];
  const today = new Date();
  const weekday = new Intl.DateTimeFormat("en-US", { weekday: "short" })
    .format(today)
    .toUpperCase();
  const monthYear = new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "numeric",
  })
    .format(today)
    .replace(" ", " · ")
    .toUpperCase();
  const startOfYear = new Date(today.getFullYear(), 0, 0);
  const edition = Math.floor(
    (today.getTime() - startOfYear.getTime()) / 86_400_000,
  );

  return (
    <div className="page-wrap">
      <section className="edition-header">
        <div className="edition-date">
          <span>{weekday}</span>
          <strong>{today.getDate()}</strong>
          <span>{monthYear}</span>
        </div>
        <div className="edition-title">
          <p className="eyebrow">
            DAILY ORBIT · EDITION {String(edition).padStart(3, "0")}
          </p>
          <h1>今天值得读的 <em>{props.feed.length}</em> 篇</h1>
          <p className="edition-deck">
            综合兴趣匹配、阅读反馈、时效、影响力与证据质量，再做主题去重，保留 10 篇最值得投入注意力的工作。
          </p>
        </div>
        <div className="edition-controls">
          <span>{props.refreshNote}</span>
          <button type="button" onClick={props.onRefresh} disabled={props.refreshing}>
            {props.refreshing ? "扫描中…" : "刷新今日选刊 ↻"}
          </button>
        </div>
        <div className="interest-strip" aria-label="当前研究兴趣">
          {props.interests.map((interest) => (
            <span key={interest}>{interest}</span>
          ))}
        </div>
      </section>

      <div className="content-grid">
        <section className="paper-list" aria-labelledby="today-papers">
          <h2 id="today-papers" className="sr-only">
            今日论文
          </h2>
          {props.feed.map((paper, index) => (
            <PaperEntry
              key={paper.id}
              paper={paper}
              index={index}
              featured={index === 0}
              saved={props.savedIds.has(paper.id)}
              reading={props.readIds.has(paper.id)}
              onToggleSaved={props.onToggleSaved}
              onStartReading={props.onStartReading}
              onGenerateReport={props.onGenerateReport}
            />
          ))}
        </section>

        <aside className="research-aside">
          <section className="copilot-note" aria-labelledby="copilot-title">
            <div className="note-pin" aria-hidden="true" />
            <div className="aside-heading">
              <div>
                <p>AI RESEARCH COMPANION</p>
                <h2 id="copilot-title">Paper Copilot</h2>
              </div>
              <span className={`ai-status ${props.aiMode}`}>
                {props.aiMode === "openai" ? "OPENAI" : "摘要模式"}
              </span>
            </div>

            <label className="paper-select-label" htmlFor="copilot-paper">
              当前论文
            </label>
            <select
              id="copilot-paper"
              className="paper-select"
              value={props.copilotPaperId}
              onChange={(event) => props.onSelectCopilotPaper(event.target.value)}
            >
              {props.allPapers.map((paper) => (
                <option key={paper.id} value={paper.id}>
                  {paper.title}
                </option>
              ))}
            </select>

            <div className="chat-window" aria-live="polite">
              {props.chat.slice(-4).map((message, index) => (
                <div key={`${message.role}-${index}`} className={`chat-message ${message.role}`}>
                  <span>{message.role === "assistant" ? "PO" : "YOU"}</span>
                  <p>{message.text}</p>
                </div>
              ))}
              {props.aiBusy ? (
                <div className="chat-message assistant typing">
                  <span>PO</span>
                  <p>正在阅读论文上下文<span aria-hidden="true">…</span></p>
                </div>
              ) : null}
            </div>

            <div className="quick-prompts">
              {quickPrompts.map((prompt) => (
                <button key={prompt} type="button" onClick={() => props.onAskAi(prompt)} disabled={props.aiBusy}>
                  {prompt}
                </button>
              ))}
            </div>

            <form
              className="copilot-form"
              onSubmit={(event) => {
                event.preventDefault();
                props.onAskAi();
              }}
            >
              <label className="sr-only" htmlFor="ai-question">
                向论文助手提问
              </label>
              <textarea
                id="ai-question"
                value={props.aiInput}
                onChange={(event) => props.onAiInput(event.target.value)}
                placeholder="问这篇论文的方法、公式、实验或局限…"
                rows={3}
              />
              <button type="submit" disabled={!props.aiInput.trim() || props.aiBusy} aria-label="发送问题">
                ↑
              </button>
            </form>
            <button className="codex-button" type="button" onClick={props.onSendToCodex}>
              交给 Codex 深挖这篇论文 ↗
            </button>
          </section>

          <section className="weekly-progress" aria-labelledby="progress-title">
            <div className="aside-heading compact">
              <div>
                <p>WEEK 29 / READING LOG</p>
                <h2 id="progress-title">本周阅读进度</h2>
              </div>
              <strong>{completedThisWeek}/10</strong>
            </div>
            <div className="week-days" aria-label={`本周完成 ${completedThisWeek} 篇`}>
              {["M", "T", "W", "T", "F", "S", "S"].map((day, index) => (
                <div key={`${day}-${index}`} className={index < Math.min(completedThisWeek, 7) ? "done" : index === 6 ? "today" : ""}>
                  <span>{day}</span>
                  <i />
                </div>
              ))}
            </div>
            <div className="progress-track">
              <i style={{ width: `${progress}%` }} />
            </div>
            <div className="progress-facts">
              <div><strong>{props.readIds.size}</strong><span>已开始</span></div>
              <div><strong>{props.savedIds.size}</strong><span>待阅读</span></div>
              <div><strong>{props.reports.length}</strong><span>份报告</span></div>
            </div>
          </section>

          <blockquote className="margin-note">
            “A good reading system does not collect more. It returns you to what matters.”
            <cite>— FIELD NOTE 028</cite>
          </blockquote>
        </aside>
      </div>
    </div>
  );
}

type CollectionViewProps = {
  eyebrow: string;
  title: string;
  description: string;
  papers: Paper[];
  emptyLabel: string;
  savedIds: Set<string>;
  readIds: Set<string>;
  loading?: boolean;
  onToggleSaved: (id: string) => void;
  onStartReading: (paper: Paper) => void;
  onGenerateReport: (paper: Paper) => void;
  onUseSuggestion?: (query: string) => void;
};

function CollectionView(props: CollectionViewProps) {
  return (
    <div className="page-wrap collection-page">
      <section className="collection-header">
        <p className="eyebrow">{props.eyebrow}</p>
        <h1>{props.title}</h1>
        <p>{props.description}</p>
        {props.onUseSuggestion ? (
          <div className="search-suggestions">
            {["physical reasoning", "vision-language-action", "world models", "AI for science"].map((query) => (
              <button key={query} type="button" onClick={() => props.onUseSuggestion?.(query)}>
                {query} ↗
              </button>
            ))}
          </div>
        ) : null}
      </section>
      {props.loading ? <div className="loading-rule"><i /></div> : null}
      <section className="paper-list collection-list">
        {props.papers.length ? (
          props.papers.map((paper, index) => (
            <PaperEntry
              key={paper.id}
              paper={paper}
              index={index}
              saved={props.savedIds.has(paper.id)}
              reading={props.readIds.has(paper.id)}
              onToggleSaved={props.onToggleSaved}
              onStartReading={props.onStartReading}
              onGenerateReport={props.onGenerateReport}
            />
          ))
        ) : (
          <div className="empty-state">
            <span aria-hidden="true">◎</span>
            <h2>索引仍是空的</h2>
            <p>{props.emptyLabel}</p>
          </div>
        )}
      </section>
    </div>
  );
}

type ReportsViewProps = {
  reports: ReadingReport[];
  onOpen: (report: ReadingReport) => void;
  onDownload: (report: ReadingReport) => void;
  onGoToday: () => void;
};

function ReportsView({ reports, onOpen, onDownload, onGoToday }: ReportsViewProps) {
  return (
    <div className="page-wrap collection-page reports-page">
      <section className="collection-header">
        <p className="eyebrow">REPORTS / RESEARCH MEMORY</p>
        <h1>把阅读变成可返回的知识</h1>
        <p>{reports.length} 份报告保存在这台设备上，可随时打开或导出 Markdown。</p>
      </section>
      {reports.length ? (
        <div className="report-index">
          {reports.map((report, index) => (
            <article key={report.id}>
              <div className="report-number">{String(index + 1).padStart(2, "0")}</div>
              <div>
                <p>{report.paperId} · {new Date(report.createdAt).toLocaleDateString("zh-CN")}</p>
                <h2>{report.paperTitle}</h2>
                <span>{report.mode === "openai" ? "OpenAI 深度分析" : "摘要辅助模式"}</span>
              </div>
              <div className="report-actions">
                <button type="button" onClick={() => onOpen(report)}>打开报告</button>
                <button type="button" onClick={() => onDownload(report)}>下载 .md</button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state report-empty">
          <span aria-hidden="true">¶</span>
          <h2>还没有阅读报告</h2>
          <p>在任意论文右侧点击“生成报告”，Paper Copilot 会整理问题、方法、贡献、证据和追问。</p>
          <button className="primary-button" type="button" onClick={onGoToday}>回到今日选刊</button>
        </div>
      )}
    </div>
  );
}
