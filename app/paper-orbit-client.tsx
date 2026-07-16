"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_PROJECT_ID,
  adjustAffinityProfile,
  canonicalPaperId,
  loadAffinityProfile,
  parseFeedbackStorage,
  rankPapersLocally,
  upsertPaperFeedback,
  type AffinityProfileV3,
  type CandidatePaper,
  type FeedbackKind,
  type InfluenceSignal,
  type PaperFeedback,
  type RecommendationDetails,
} from "./api/arxiv/recommendation";
import type {
  ArxivSearchField,
  ArxivSearchMatch,
  ArxivSearchOrder,
  ArxivSearchSort,
} from "./api/arxiv/search-query";
import {
  claimLegacyStorage,
  storageKeysFor,
} from "./local-user-storage";

type View = "today" | "discover" | "library" | "reports";
type AiMode = "openai" | "preview";
type AiConnectionSource = "session" | "shared" | null;

type AiConnection = {
  connected: boolean;
  source: AiConnectionSource;
  model: string | null;
  sessionAvailable: boolean;
};

type ResearchConnection = {
  arxiv: {
    keyRequired: false;
    source: "public";
  };
  semanticScholar: {
    keyConnected: boolean;
    source: "session" | "shared" | "public";
    sessionAvailable: boolean;
  };
};

type AiUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
};

type AiRunMeta = {
  source: "fulltext-pdf" | "abstract-preview";
  model: string | null;
  pdfDetail?: "low" | "high";
  usage?: AiUsage | null;
};

type Paper = CandidatePaper & {
  zhSummary?: string;
  score: number;
  recommendation?: RecommendationDetails;
};

type SearchFilters = {
  field: ArxivSearchField;
  match: ArxivSearchMatch;
  exclude: string;
  category: string;
  fromYear: string;
  toYear: string;
  sort: ArxivSearchSort;
  order: ArxivSearchOrder;
  limit: number;
};

type SearchMeta = {
  totalResults: number;
  start: number;
  limit: number;
  hasPrevious: boolean;
  hasNext: boolean;
};

type ToastNotice = {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
};

export type PaperOrbitViewer = {
  displayName: string;
  email: string;
  initials: string;
  role: "owner" | "manager" | "reader";
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
  mode: AiMode;
};

const DEFAULT_INTERESTS = [
  "Physical AI",
  "Multimodal Reasoning",
  "Embodied Intelligence",
];

const DAILY_PAPER_COUNT = 10;

const VIEWER_ROLE_LABELS: Record<PaperOrbitViewer["role"], string> = {
  owner: "OWNER",
  manager: "MANAGER",
  reader: "READER",
};

const DEFAULT_RESEARCH_CONNECTION: ResearchConnection = {
  arxiv: {
    keyRequired: false,
    source: "public",
  },
  semanticScholar: {
    keyConnected: false,
    source: "public",
    sessionAvailable: false,
  },
};

const DEFAULT_SEARCH_FILTERS: SearchFilters = {
  field: "all",
  match: "all",
  exclude: "",
  category: "",
  fromYear: "",
  toYear: "",
  sort: "relevance",
  order: "descending",
  limit: 20,
};

const FEEDBACK_LABELS: Record<FeedbackKind, string> = {
  relevant: "相关",
  not_relevant: "不相关",
  too_broad: "过于宽泛",
  already_knew: "已读过 / 已知",
};

const COPILOT_WELCOME: ChatMessage = {
  role: "assistant",
  text: "连接 OpenAI 后，我会直接阅读所选论文的 arXiv PDF 全文。你可以问核心机制、公式、图表、实验或复现风险。",
};

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

function uniquePapers(...groups: Paper[][]) {
  const map = new Map<string, Paper>();
  groups.flat().forEach((paper) => {
    const id = canonicalPaperId(paper.id);
    if (!map.has(id)) map.set(id, paper);
  });
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
  const storage = useMemo(() => storageKeysFor(viewer.email), [viewer.email]);
  const [activeView, setActiveView] = useState<View>("today");
  const [candidatePool, setCandidatePool] = useState<Paper[]>(SEED_PAPERS);
  const [searchResults, setSearchResults] = useState<Paper[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFilters, setSearchFilters] = useState<SearchFilters>(
    DEFAULT_SEARCH_FILTERS,
  );
  const [searchMeta, setSearchMeta] = useState<SearchMeta | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchMessage, setSearchMessage] = useState("搜索标题、作者、主题或 arXiv ID");
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [reports, setReports] = useState<ReadingReport[]>([]);
  const [interests, setInterests] = useState(DEFAULT_INTERESTS);
  const [affinity, setAffinity] = useState<AffinityProfileV3>({
    version: 3,
    signals: {},
  });
  const [paperFeedback, setPaperFeedback] = useState<PaperFeedback[]>([]);
  const [rankingNow, setRankingNow] = useState(() => Date.now());
  const [draftInterests, setDraftInterests] = useState(DEFAULT_INTERESTS);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [aiSettingsOpen, setAiSettingsOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshNote, setRefreshNote] = useState("多信号选刊 · 每日更新");
  const [copilotPaperId, setCopilotPaperId] = useState(SEED_PAPERS[0].id);
  const [aiInput, setAiInput] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiMode, setAiMode] = useState<AiMode>("preview");
  const [aiConnection, setAiConnection] = useState<AiConnection>({
    connected: false,
    source: null,
    model: null,
    sessionAvailable: false,
  });
  const [aiConnectionReady, setAiConnectionReady] = useState(false);
  const [aiConnectionBusy, setAiConnectionBusy] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [aiConnectionMessage, setAiConnectionMessage] = useState("");
  const [researchConnection, setResearchConnection] = useState<ResearchConnection>(
    DEFAULT_RESEARCH_CONNECTION,
  );
  const [researchConnectionReady, setResearchConnectionReady] = useState(false);
  const [researchConnectionBusy, setResearchConnectionBusy] = useState(false);
  const [semanticScholarKeyInput, setSemanticScholarKeyInput] = useState("");
  const [researchConnectionMessage, setResearchConnectionMessage] = useState("");
  const [lastAiRun, setLastAiRun] = useState<AiRunMeta | null>(null);
  const [chat, setChat] = useState<ChatMessage[]>([COPILOT_WELCOME]);
  const [activeReport, setActiveReport] = useState<ReadingReport | null>(null);
  const [toast, setToast] = useState<ToastNotice | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const influenceById = useMemo(() => {
    const influence = new Map<string, InfluenceSignal>();
    for (const paper of candidatePool) {
      const citationCount = paper.recommendation?.citationCount;
      const influentialCitationCount =
        paper.recommendation?.influentialCitationCount;
      if (
        typeof citationCount === "number"
        || typeof influentialCitationCount === "number"
      ) {
        influence.set(paper.id, {
          citationCount: citationCount ?? 0,
          influentialCitationCount: influentialCitationCount ?? 0,
        });
      }
    }
    return influence;
  }, [candidatePool]);

  const feed = useMemo(
    () => rankPapersLocally(
      candidatePool,
      SEED_PAPERS,
      interests,
      affinity,
      paperFeedback,
      influenceById,
      DAILY_PAPER_COUNT,
      { now: new Date(rankingNow), projectId: DEFAULT_PROJECT_ID },
    ) as Paper[],
    [affinity, candidatePool, influenceById, interests, paperFeedback, rankingNow],
  );

  const allPapers = useMemo(
    () => uniquePapers(feed, candidatePool, searchResults, SEED_PAPERS),
    [candidatePool, feed, searchResults],
  );
  const copilotPaper =
    allPapers.find(
      (paper) => canonicalPaperId(paper.id) === canonicalPaperId(copilotPaperId),
    ) ?? feed[0];
  const libraryPapers = allPapers.filter((paper) => savedIds.has(paper.id));

  useEffect(() => {
    claimLegacyStorage(
      localStorage,
      storage,
      viewer.email,
      viewer.role !== "reader",
    );
    setSavedIds(new Set(safeParse<string[]>(localStorage.getItem(storage.saved), [])));
    setReadIds(new Set(safeParse<string[]>(localStorage.getItem(storage.read), [])));
    setReports(
      safeParse<ReadingReport[]>(localStorage.getItem(storage.reports), []),
    );
    const storedCandidates = safeParse<Paper[]>(
      localStorage.getItem(storage.candidates),
      [],
    );
    if (storedCandidates.length) setCandidatePool(uniquePapers(storedCandidates));
    const storedInterests = safeParse<string[]>(
      localStorage.getItem(storage.interests),
      DEFAULT_INTERESTS,
    );
    const storedAffinity = loadAffinityProfile(
      localStorage.getItem(storage.affinity),
      localStorage.getItem(storage.legacyAffinity),
      new Date(),
    );
    setInterests(storedInterests);
    setAffinity(storedAffinity.profile);
    setPaperFeedback(
      parseFeedbackStorage(localStorage.getItem(storage.feedback)),
    );
    if (storedAffinity.migrated) {
      localStorage.setItem(
        storage.affinity,
        JSON.stringify(storedAffinity.profile),
      );
    }
    setDraftInterests(storedInterests);
    setRankingNow(Date.now());
    setReady(true);

    const today = new Date().toISOString().slice(0, 10);
    if (
      !storedCandidates.length
      || localStorage.getItem(storage.refresh) !== today
    ) {
      void refreshDaily(true);
    }
    void loadAiConnection();
    void loadResearchConnection();
    // Bootstrap from browser storage exactly once; refreshDaily reads no personal state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(storage.saved, JSON.stringify(Array.from(savedIds)));
  }, [ready, savedIds, storage.saved]);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(storage.read, JSON.stringify(Array.from(readIds)));
  }, [ready, readIds, storage.read]);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(storage.reports, JSON.stringify(reports));
  }, [ready, reports, storage.reports]);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(storage.affinity, JSON.stringify(affinity));
  }, [affinity, ready, storage.affinity]);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(storage.feedback, JSON.stringify(paperFeedback));
  }, [paperFeedback, ready, storage.feedback]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setActiveView("discover");
        searchRef.current?.focus();
      }
      if (event.key === "Escape") {
        setSettingsOpen(false);
        setAiSettingsOpen(false);
        setActiveReport(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(
      () => setToast(null),
      toast.onAction ? 5_000 : 2_400,
    );
    return () => window.clearTimeout(timer);
  }, [toast]);

  function showToast(
    message: string,
    actionLabel?: string,
    onAction?: () => void,
  ) {
    setToast({ message, actionLabel, onAction });
  }

  async function refreshDaily(silent = false) {
    setRefreshing(true);
    if (!silent) setRefreshNote("正在扫描候选池并重新排序…");
    try {
      const response = await fetch("/api/arxiv?mode=feed", {
        cache: "no-store",
      });
      if (!response.ok) throw new Error("feed unavailable");
      const data = (await response.json()) as {
        papers?: Paper[];
        source?: string;
        meta?: {
          candidateCount?: number;
          metadataCredential?: "session" | "shared" | "public";
          rankingVersion?: string;
        };
      };
      if (data.papers?.length) {
        const nextCandidates = uniquePapers(data.papers);
        setCandidatePool(nextCandidates);
        localStorage.setItem(
          storage.candidates,
          JSON.stringify(nextCandidates),
        );
        setRankingNow(Date.now());
        localStorage.setItem(
          storage.refresh,
          new Date().toISOString().slice(0, 10),
        );
        const candidateCount = data.meta?.candidateCount ?? data.papers.length;
        const sourceLabel = data.meta?.metadataCredential === "session"
          ? "个人影响力数据已校准"
          : data.meta?.metadataCredential === "shared"
            ? "站点影响力数据已校准"
            : data.source?.includes("semantic-scholar")
              ? "公开影响力信号已校准"
              : "arXiv 公开候选池";
        setRefreshNote(
          `从 ${candidateCount} 篇候选中在本机精选 · ${sourceLabel}`,
        );
        if (!silent) showToast("今日 10 篇已在本机重新排序");
      }
    } catch {
      setRefreshNote("编辑部缓存 · 网络恢复后自动更新");
    } finally {
      setRefreshing(false);
    }
  }

  function learnFromPaper(paper: Paper, weight: number) {
    const now = new Date();
    setAffinity((current) => adjustAffinityProfile(current, paper, weight, now));
    setRankingNow(now.getTime());
  }

  function updateSearchQuery(value: string) {
    setSearchQuery(value);
    setSearchMeta(null);
  }

  function updateSearchFilter<K extends keyof SearchFilters>(
    name: K,
    value: SearchFilters[K],
  ) {
    setSearchFilters((current) => ({ ...current, [name]: value }));
    setSearchMeta(null);
  }

  async function submitSearch(
    event?: FormEvent,
    queryOverride?: string,
    startOverride = 0,
  ) {
    event?.preventDefault();
    const query = (queryOverride ?? searchQuery).trim();
    if (!query) {
      searchRef.current?.focus();
      return;
    }
    if (queryOverride !== undefined) setSearchQuery(query);
    setActiveView("discover");
    setSearchLoading(true);
    setSearchMessage(`正在 arXiv 中检索“${query}”…`);
    try {
      const params = new URLSearchParams({
        q: query,
        field: searchFilters.field,
        match: searchFilters.match,
        sort: searchFilters.sort,
        order: searchFilters.order,
        start: String(Math.max(0, startOverride)),
        limit: String(searchFilters.limit),
      });
      if (searchFilters.exclude.trim()) {
        params.set("exclude", searchFilters.exclude.trim());
      }
      if (searchFilters.category) params.set("category", searchFilters.category);
      if (searchFilters.fromYear) params.set("fromYear", searchFilters.fromYear);
      if (searchFilters.toYear) params.set("toYear", searchFilters.toYear);
      const response = await fetch(`/api/arxiv?${params.toString()}`, {
        cache: "no-store",
      });
      if (!response.ok) throw new Error("search unavailable");
      const data = (await response.json()) as {
        papers?: Paper[];
        meta?: SearchMeta;
      };
      const papers = data.papers ?? [];
      setSearchResults(papers);
      setSearchMeta(data.meta ?? null);
      const total = data.meta?.totalResults ?? papers.length;
      const first = papers.length ? (data.meta?.start ?? 0) + 1 : 0;
      const last = (data.meta?.start ?? 0) + papers.length;
      setSearchMessage(
        papers.length
          ? `显示第 ${first}–${last} 篇，共 ${total} 篇结果`
          : "没有找到结果，试试更宽的关键词或清除筛选",
      );
    } catch {
      const local = startOverride === 0 ? SEED_PAPERS.filter((paper) =>
        `${paper.title} ${paper.summary} ${paper.tags.join(" ")}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      ) : [];
      setSearchResults(local);
      setSearchMeta(null);
      setSearchMessage(
        local.length ? "实时搜索暂不可用，先显示编辑部缓存" : "实时搜索暂不可用，请稍后重试",
      );
    } finally {
      setSearchLoading(false);
    }
  }

  function clearSearch() {
    setSearchQuery("");
    setSearchFilters(DEFAULT_SEARCH_FILTERS);
    setSearchResults([]);
    setSearchMeta(null);
    setSearchMessage("搜索标题、作者、主题或 arXiv ID");
    searchRef.current?.focus();
  }

  function updatePaperFeedback(paper: Paper, kind: FeedbackKind) {
    const previous = paperFeedback.find(
      (item) =>
        item.projectId === DEFAULT_PROJECT_ID
        && canonicalPaperId(item.paperId) === canonicalPaperId(paper.id),
    );
    const nextKind = previous?.kind === kind ? null : kind;
    const now = new Date();
    setPaperFeedback((current) =>
      upsertPaperFeedback(current, paper.id, nextKind, now),
    );
    setRankingNow(now.getTime());
    showToast(
      nextKind ? "反馈已保存，推荐顺序已更新" : "已清除这篇论文的反馈",
      "撤销",
      () => {
        const undoNow = new Date();
        setPaperFeedback((current) =>
          upsertPaperFeedback(
            current,
            paper.id,
            previous?.kind ?? null,
            undoNow,
          ),
        );
        setRankingNow(undoNow.getTime());
        setToast(null);
      },
    );
  }

  function clearStoredFeedback(item: PaperFeedback) {
    const now = new Date();
    setPaperFeedback((current) =>
      upsertPaperFeedback(
        current,
        item.paperId,
        null,
        now,
        item.projectId,
      ),
    );
    setRankingNow(now.getTime());
    showToast("这条论文反馈已清除");
  }

  function toggleSaved(id: string) {
    const paper = allPapers.find((item) => item.id === id);
    const wasSaved = savedIds.has(id);
    setSavedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
        showToast("已从书库移除");
      } else {
        next.add(id);
        showToast("已保存到书库");
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

  async function loadAiConnection() {
    try {
      const response = await fetch("/api/ai/session", {
        credentials: "same-origin",
        cache: "no-store",
      });
      const data = (await response.json()) as AiConnection & { error?: string };
      if (!response.ok) throw new Error(data.error || "无法读取 AI 连接状态");
      setAiConnection(data);
      setAiMode(data.connected ? "openai" : "preview");
    } catch {
      setAiConnectionMessage("暂时无法读取 AI 连接状态。");
    } finally {
      setAiConnectionReady(true);
    }
  }

  async function connectOpenAI(event: FormEvent) {
    event.preventDefault();
    const apiKey = apiKeyInput.trim();
    if (!apiKey || aiConnectionBusy) return;
    setAiConnectionBusy(true);
    setAiConnectionMessage("正在验证并建立加密会话…");
    try {
      const response = await fetch("/api/ai/session", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey }),
      });
      const data = (await response.json()) as AiConnection & { error?: string };
      if (!response.ok) throw new Error(data.error || "连接 OpenAI 失败");
      setAiConnection(data);
      setAiMode("openai");
      setAiConnectionMessage("已连接。之后的提问会读取 arXiv PDF 全文并计入你的 OpenAI API 用量。");
      showToast("OpenAI 全文 Copilot 已连接");
    } catch (error) {
      setAiConnectionMessage(
        error instanceof Error ? error.message : "连接 OpenAI 失败，请稍后重试。",
      );
    } finally {
      setApiKeyInput("");
      setAiConnectionBusy(false);
    }
  }

  async function disconnectOpenAI() {
    if (aiConnectionBusy) return;
    setAiConnectionBusy(true);
    try {
      const response = await fetch("/api/ai/session", {
        method: "DELETE",
        credentials: "same-origin",
      });
      const data = (await response.json()) as AiConnection & { error?: string };
      if (!response.ok) throw new Error(data.error || "断开连接失败");
      setAiConnection(data);
      setAiMode(data.connected ? "openai" : "preview");
      setLastAiRun(null);
      setAiConnectionMessage(
        data.connected ? "个人会话已清除；当前仍使用站点配置的共享 OpenAI 连接。" : "个人 OpenAI 会话已从此浏览器清除。",
      );
      showToast("个人 OpenAI 会话已断开");
    } catch (error) {
      setAiConnectionMessage(
        error instanceof Error ? error.message : "断开连接失败，请稍后重试。",
      );
    } finally {
      setAiConnectionBusy(false);
    }
  }

  async function loadResearchConnection() {
    try {
      const response = await fetch("/api/arxiv/session", {
        credentials: "same-origin",
        cache: "no-store",
      });
      const data = (await response.json()) as ResearchConnection & {
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error || "无法读取论文数据连接状态");
      }
      setResearchConnection(data);
    } catch {
      setResearchConnectionMessage("暂时无法读取论文数据连接状态。");
    } finally {
      setResearchConnectionReady(true);
    }
  }

  async function connectSemanticScholar(event: FormEvent) {
    event.preventDefault();
    const apiKey = semanticScholarKeyInput.trim();
    if (!apiKey || researchConnectionBusy) return;
    setResearchConnectionBusy(true);
    setResearchConnectionMessage("正在验证并建立加密论文数据会话…");
    try {
      const response = await fetch("/api/arxiv/session", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey }),
      });
      const data = (await response.json()) as ResearchConnection & {
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error || "连接 Semantic Scholar 失败");
      }
      setResearchConnection(data);
      setResearchConnectionMessage(
        "已连接。刷新选刊时会使用你的 Semantic Scholar API 配额读取引用影响力信号。",
      );
      showToast("个人论文影响力数据已连接");
      await refreshDaily(true);
    } catch (error) {
      setResearchConnectionMessage(
        error instanceof Error
          ? error.message
          : "连接 Semantic Scholar 失败，请稍后重试。",
      );
    } finally {
      setSemanticScholarKeyInput("");
      setResearchConnectionBusy(false);
    }
  }

  async function disconnectSemanticScholar() {
    if (researchConnectionBusy) return;
    setResearchConnectionBusy(true);
    try {
      const response = await fetch("/api/arxiv/session", {
        method: "DELETE",
        credentials: "same-origin",
      });
      const data = (await response.json()) as ResearchConnection & {
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error || "断开论文数据连接失败");
      }
      setResearchConnection(data);
      setResearchConnectionMessage(
        data.semanticScholar.source === "shared"
          ? "个人会话已清除；当前仅 OWNER/MANAGER 使用站点共享的论文元数据连接。"
          : "个人 Semantic Scholar 会话已从此浏览器清除；arXiv 公开检索仍可继续使用。",
      );
      showToast("个人论文数据会话已断开");
      await refreshDaily(true);
    } catch (error) {
      setResearchConnectionMessage(
        error instanceof Error
          ? error.message
          : "断开论文数据连接失败，请稍后重试。",
      );
    } finally {
      setResearchConnectionBusy(false);
    }
  }

  function selectCopilotPaper(id: string) {
    setCopilotPaperId(id);
    setChat([COPILOT_WELCOME]);
    setLastAiRun(null);
  }

  async function askAI(question?: string) {
    const prompt = (question ?? aiInput).trim();
    if (!prompt || !copilotPaper || aiBusy) return;
    const history = chat.slice(-8);
    setAiInput("");
    setChat((current) => [...current, { role: "user", text: prompt }]);
    setAiBusy(true);
    try {
      const response = await fetch("/api/ai", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paper: copilotPaper,
          prompt,
          action: "chat",
          history,
        }),
      });
      const data = (await response.json()) as {
        answer?: string;
        error?: string;
        mode?: AiMode;
        source?: AiRunMeta["source"];
        model?: string | null;
        pdfDetail?: AiRunMeta["pdfDetail"];
        usage?: AiUsage | null;
      };
      if (!response.ok || !data.answer || !data.mode) {
        throw new Error(data.error || "这次全文分析没有完成。");
      }
      const answer = data.answer;
      const mode = data.mode;
      setAiMode(mode);
      setLastAiRun({
        source: data.source ?? (mode === "openai" ? "fulltext-pdf" : "abstract-preview"),
        model: data.model ?? aiConnection.model,
        pdfDetail: data.pdfDetail,
        usage: data.usage,
      });
      setChat((current) => [
        ...current,
        { role: "assistant", text: answer },
      ]);
    } catch (error) {
      setChat((current) => [
        ...current,
        {
          role: "assistant",
          text:
            error instanceof Error
              ? error.message
              : "这次全文分析没有完成，请稍后重试。",
        },
      ]);
    } finally {
      setAiBusy(false);
    }
  }

  async function generateReport(paper: Paper) {
    if (aiBusy) return;
    setCopilotPaperId(paper.id);
    setChat([COPILOT_WELCOME]);
    setLastAiRun(null);
    setAiBusy(true);
    showToast("正在生成阅读报告…");
    try {
      const response = await fetch("/api/ai", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paper,
          action: "report",
          prompt: `请阅读 PDF 全文，用自然、连贯的简体中文生成结构化报告：研究问题、核心方法、关键贡献、证据强弱、局限、与我兴趣的关系、三个追问。我的研究兴趣是 ${interests.join("、")}。请综合正文、公式、图表、实验与附录，尽可能给出可核验位置；不要逐句翻译、复述或大段复制论文，并明确区分正文事实、合理推断与论文未提供的证据。`,
        }),
      });
      const data = (await response.json()) as {
        answer?: string;
        error?: string;
        mode?: AiMode;
        source?: AiRunMeta["source"];
        model?: string | null;
        pdfDetail?: AiRunMeta["pdfDetail"];
        usage?: AiUsage | null;
      };
      if (!response.ok || !data.answer || !data.mode) {
        throw new Error(data.error || "报告暂未生成。");
      }
      setAiMode(data.mode);
      setLastAiRun({
        source: data.source ?? (data.mode === "openai" ? "fulltext-pdf" : "abstract-preview"),
        model: data.model ?? aiConnection.model,
        pdfDetail: data.pdfDetail,
        usage: data.usage,
      });
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
      showToast("阅读报告已生成并保存");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "报告暂未生成，请稍后重试");
    } finally {
      setAiBusy(false);
    }
  }

  async function deepReadWithCopilot() {
    if (!copilotPaper) return;
    await askAI(
      `请基于 PDF 全文深度分析这篇论文。我的研究兴趣是 ${interests.join("、")}。请重点解释核心机制、关键公式与图表、证据是否支撑结论、与相关工作的差异，以及最值得复现的实验，并标注可核验的位置。`,
    );
  }

  function saveInterests() {
    const next = draftInterests.length ? draftInterests : DEFAULT_INTERESTS;
    setInterests(next);
    localStorage.setItem(storage.interests, JSON.stringify(next));
    setSettingsOpen(false);
    setRankingNow(Date.now());
    showToast("兴趣画像已更新，本机推荐已重排");
    void refreshDaily();
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
              onChange={(event) => updateSearchQuery(event.target.value)}
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
            title={`${viewer.email} · ${VIEWER_ROLE_LABELS[viewer.role]}`}
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
            aiConnection={aiConnection}
            aiConnectionReady={aiConnectionReady}
            lastAiRun={lastAiRun}
            paperFeedback={paperFeedback}
            onRefresh={() => void refreshDaily()}
            onToggleSaved={toggleSaved}
            onStartReading={startReading}
            onGenerateReport={(paper) => void generateReport(paper)}
            onPaperFeedback={updatePaperFeedback}
            onSelectCopilotPaper={selectCopilotPaper}
            onAiInput={setAiInput}
            onAskAi={(question) => void askAI(question)}
            onOpenAiSettings={() => {
              setAiConnectionMessage("");
              setResearchConnectionMessage("");
              setAiSettingsOpen(true);
            }}
            onDeepRead={() => void deepReadWithCopilot()}
          />
        ) : null}

        {activeView === "discover" ? (
          <DiscoverView
            query={searchQuery}
            filters={searchFilters}
            meta={searchMeta}
            message={searchMessage}
            papers={searchResults}
            savedIds={savedIds}
            readIds={readIds}
            loading={searchLoading}
            onQueryChange={updateSearchQuery}
            onFilterChange={updateSearchFilter}
            onSubmit={(event) => void submitSearch(event)}
            onClear={clearSearch}
            onPrevious={() => {
              if (!searchMeta) return;
              void submitSearch(
                undefined,
                undefined,
                Math.max(0, searchMeta.start - searchMeta.limit),
              );
            }}
            onNext={() => {
              if (!searchMeta) return;
              void submitSearch(
                undefined,
                undefined,
                searchMeta.start + searchMeta.limit,
              );
            }}
            onToggleSaved={toggleSaved}
            onStartReading={startReading}
            onGenerateReport={(paper) => void generateReport(paper)}
            onUseSuggestion={(query) => {
              updateSearchQuery(query);
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
              <b>{VIEWER_ROLE_LABELS[viewer.role]}</b>
              <div className="viewer-actions">
                <button
                  type="button"
                  onClick={() => {
                    setSettingsOpen(false);
                    setAiConnectionMessage("");
                    setResearchConnectionMessage("");
                    setAiSettingsOpen(true);
                  }}
                >
                  管理 API 连接
                </button>
                <a href="/signout-with-chatgpt?return_to=%2F">切换账号</a>
              </div>
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
            <section className="feedback-history" aria-labelledby="feedback-history-title">
              <div>
                <p className="eyebrow">LOCAL FEEDBACK</p>
                <h3 id="feedback-history-title">论文反馈记录</h3>
              </div>
              <p>
                这些信号只保存在当前浏览器。即使论文暂时离开今日列表，也能在这里清除反馈。
              </p>
              {paperFeedback.length ? (
                <ul>
                  {paperFeedback.map((item) => {
                    const paper = allPapers.find(
                      (candidate) =>
                        canonicalPaperId(candidate.id)
                        === canonicalPaperId(item.paperId),
                    );
                    return (
                      <li key={`${item.projectId}:${item.paperId}`}>
                        <span>
                          <strong>{paper?.title ?? `arXiv ${item.paperId}`}</strong>
                          <small>{FEEDBACK_LABELS[item.kind]}</small>
                        </span>
                        <button
                          type="button"
                          onClick={() => clearStoredFeedback(item)}
                          aria-label={`清除 ${paper?.title ?? item.paperId} 的反馈`}
                        >
                          清除
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="feedback-history-empty">尚未记录显式论文反馈。</p>
              )}
            </section>
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

      {aiSettingsOpen ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setAiSettingsOpen(false)}>
          <section
            className="modal-sheet ai-connect-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ai-connect-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button className="modal-close" type="button" onClick={() => setAiSettingsOpen(false)} aria-label="关闭">
              ×
            </button>
            <p className="eyebrow">PERSONAL API CONNECTIONS / ENCRYPTED SESSION</p>
            <h2 id="ai-connect-title">连接你的研究服务</h2>
            <p>
              每位 READER 使用自己的外部服务额度。OpenAI Key 用于 PDF 全文 Copilot；arXiv 公开检索不需要 Key；可选的 Semantic Scholar Key 用于更稳定地读取引用与高影响引用信号。
            </p>

            <section className="provider-section" aria-labelledby="openai-provider-title">
              <div className="provider-heading">
                <div>
                  <span>FULL-TEXT COPILOT</span>
                  <h3 id="openai-provider-title">OpenAI API</h3>
                </div>
                <small>个人计费</small>
              </div>

              <div className={`ai-connection-card ${aiConnection.connected ? "connected" : ""}`}>
                <span aria-hidden="true">{aiConnection.connected ? "✓" : "○"}</span>
                <div>
                  <strong>{aiConnection.connected ? "全文 AI 已连接" : "尚未连接真实 AI"}</strong>
                  <small>
                    {aiConnection.connected
                      ? `${aiConnection.model ?? "OpenAI"} · ${aiConnection.source === "session" ? "你的临时会话" : "仅管理账号的站点共享连接"}`
                      : "普通用户未连接个人 Key 时只提供不消耗 token 的摘要预览。"}
                  </small>
                </div>
              </div>

              {aiConnection.sessionAvailable ? (
                <form className="ai-connect-form" onSubmit={connectOpenAI}>
                  <label htmlFor="openai-api-key">
                    {aiConnection.source === "session" ? "更换个人 API Key" : "个人 OpenAI API Key"}
                  </label>
                  <div>
                    <input
                      id="openai-api-key"
                      type="password"
                      value={apiKeyInput}
                      onChange={(event) => setApiKeyInput(event.target.value)}
                      placeholder="sk-…"
                      autoComplete="off"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      disabled={aiConnectionBusy}
                    />
                    <button type="submit" disabled={!apiKeyInput.trim() || aiConnectionBusy}>
                      {aiConnectionBusy ? "连接中…" : aiConnection.source === "session" ? "验证并更换" : "验证并连接"}
                    </button>
                  </div>
                  <small>
                    Key 只用于验证和调用 OpenAI，随后保存在服务端加密的 HttpOnly 浏览器会话中；不写入 localStorage、数据库或仓库，关闭浏览器或连接满 12 小时后失效。
                  </small>
                </form>
              ) : (
                <div className="ai-config-warning">
                  服务器管理员还需要配置 <code>PAPER_ORBIT_SESSION_SECRET</code>，才能安全接收每位用户自己的 API Key。
                </div>
              )}

              {aiConnectionMessage ? (
                <p className="ai-connection-message" role="status">{aiConnectionMessage}</p>
              ) : null}

              <div className="ai-connect-links">
                <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer">
                  创建 OpenAI API Key ↗
                </a>
                <a href="https://platform.openai.com/settings/organization/billing/overview" target="_blank" rel="noreferrer">
                  查看 API 计费 ↗
                </a>
              </div>

              {aiConnection.source === "session" ? (
                <button className="provider-disconnect" type="button" onClick={() => void disconnectOpenAI()} disabled={aiConnectionBusy}>
                  清除个人 OpenAI 会话
                </button>
              ) : null}
            </section>

            <section className="provider-section" aria-labelledby="paper-data-provider-title">
              <div className="provider-heading">
                <div>
                  <span>PAPER DISCOVERY &amp; IMPACT</span>
                  <h3 id="paper-data-provider-title">论文数据 API</h3>
                </div>
                <small>按用户隔离</small>
              </div>

              <div className="provider-status-grid">
                <div className="provider-status connected">
                  <span aria-hidden="true">✓</span>
                  <div>
                    <strong>arXiv 公开 API</strong>
                    <small>检索、分类、日期与 PDF 地址 · 无需也不存在个人 API Key</small>
                  </div>
                </div>
                <div className={`provider-status ${researchConnection.semanticScholar.keyConnected ? "connected" : ""}`}>
                  <span aria-hidden="true">{researchConnection.semanticScholar.keyConnected ? "✓" : "○"}</span>
                  <div>
                    <strong>
                      {researchConnection.semanticScholar.keyConnected
                        ? "Semantic Scholar Key 已连接"
                        : "Semantic Scholar 公开额度"}
                    </strong>
                    <small>
                      {!researchConnectionReady
                        ? "正在检查连接状态…"
                        : researchConnection.semanticScholar.source === "session"
                          ? "你的临时会话 · 引用与高影响引用"
                          : researchConnection.semanticScholar.source === "shared"
                            ? "仅管理账号的站点共享连接"
                            : "无需 Key 也可使用，但高峰期可能受共享限流影响"}
                    </small>
                  </div>
                </div>
              </div>

              {researchConnection.semanticScholar.sessionAvailable ? (
                <form className="ai-connect-form" onSubmit={connectSemanticScholar}>
                  <label htmlFor="semantic-scholar-api-key">
                    {researchConnection.semanticScholar.source === "session"
                      ? "更换个人 Semantic Scholar API Key"
                      : "个人 Semantic Scholar API Key（可选）"}
                  </label>
                  <div>
                    <input
                      id="semantic-scholar-api-key"
                      type="password"
                      value={semanticScholarKeyInput}
                      onChange={(event) => setSemanticScholarKeyInput(event.target.value)}
                      placeholder="Semantic Scholar API Key"
                      autoComplete="off"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      disabled={researchConnectionBusy}
                    />
                    <button type="submit" disabled={!semanticScholarKeyInput.trim() || researchConnectionBusy}>
                      {researchConnectionBusy
                        ? "连接中…"
                        : researchConnection.semanticScholar.source === "session"
                          ? "验证并更换"
                          : "验证并连接"}
                    </button>
                  </div>
                  <small>
                    Key 仅由 Paper Orbit 后端发送到 Semantic Scholar 的 <code>x-api-key</code> 请求头，并使用与 OpenAI Key 相同的加密会话边界。
                  </small>
                </form>
              ) : (
                <div className="ai-config-warning">
                  服务器管理员还需要配置 <code>PAPER_ORBIT_SESSION_SECRET</code>，才能安全接收个人论文数据 Key。
                </div>
              )}

              {researchConnectionMessage ? (
                <p className="ai-connection-message" role="status">{researchConnectionMessage}</p>
              ) : null}

              <div className="ai-connect-links">
                <a href="https://info.arxiv.org/help/api/user-manual.html" target="_blank" rel="noreferrer">
                  arXiv API 说明 ↗
                </a>
                <a href="https://www.semanticscholar.org/product/api" target="_blank" rel="noreferrer">
                  申请 Semantic Scholar API Key ↗
                </a>
              </div>

              {researchConnection.semanticScholar.source === "session" ? (
                <button className="provider-disconnect" type="button" onClick={() => void disconnectSemanticScholar()} disabled={researchConnectionBusy}>
                  清除个人论文数据会话
                </button>
              ) : null}
            </section>

            <div className="modal-actions ai-modal-actions">
              <span>所有个人 Key 均绑定当前 ChatGPT 登录邮箱，并在 12 小时后失效。</span>
              <button className="primary-button" type="button" onClick={() => setAiSettingsOpen(false)}>
                完成
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
              {new Date(activeReport.createdAt).toLocaleString("zh-CN")} · {activeReport.mode === "openai" ? "OpenAI PDF 全文分析" : "摘要辅助模式"}
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
        <span>{toast?.message}</span>
        {toast?.onAction ? (
          <button type="button" onClick={toast.onAction}>
            {toast.actionLabel ?? "撤销"}
          </button>
        ) : null}
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
  feedback?: FeedbackKind;
  onToggleSaved: (id: string) => void;
  onStartReading: (paper: Paper) => void;
  onGenerateReport: (paper: Paper) => void;
  onPaperFeedback?: (paper: Paper, kind: FeedbackKind) => void;
};

function PaperEntry({
  paper,
  index,
  featured = false,
  saved,
  reading,
  feedback,
  onToggleSaved,
  onStartReading,
  onGenerateReport,
  onPaperFeedback,
}: PaperEntryProps) {
  const recommendation = paper.recommendation;
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
        {recommendation && onPaperFeedback ? (
          <details className="recommendation-details">
            <summary>为什么推荐</summary>
            <p>{recommendation.reason}</p>
            <div className="signal-grid" aria-label="推荐信号，满分 100">
              {(
                [
                  ["相关度", recommendation.signals.relevance],
                  ["本地偏好", recommendation.signals.affinity],
                  ["新鲜度", recommendation.signals.freshness],
                  ["影响力", recommendation.signals.influence],
                  ["证据强度", recommendation.signals.evidence],
                ] as Array<[string, number]>
              ).map(([label, value]) => (
                <span key={label}>
                  <small>{label}</small>
                  <strong>{Math.max(0, Math.min(100, value))}</strong>
                </span>
              ))}
            </div>
            <dl className="recommendation-evidence">
              <div>
                <dt>引用</dt>
                <dd>{recommendation.citationCount ?? "—"}</dd>
              </div>
              <div>
                <dt>高影响引用</dt>
                <dd>{recommendation.influentialCitationCount ?? "—"}</dd>
              </div>
              <div>
                <dt>多样性探索</dt>
                <dd>{recommendation.exploration ? "是" : "否"}</dd>
              </div>
            </dl>
            <div className="paper-feedback" role="group" aria-label={`评价 ${paper.title} 的推荐质量`}>
              {(Object.keys(FEEDBACK_LABELS) as FeedbackKind[]).map((kind) => (
                <button
                  key={kind}
                  type="button"
                  aria-pressed={feedback === kind}
                  className={feedback === kind ? "selected" : ""}
                  onClick={() => onPaperFeedback(paper, kind)}
                  title={feedback === kind ? "再次点击可清除" : undefined}
                >
                  {FEEDBACK_LABELS[kind]}
                </button>
              ))}
            </div>
          </details>
        ) : null}
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
  aiMode: AiMode;
  aiConnection: AiConnection;
  aiConnectionReady: boolean;
  lastAiRun: AiRunMeta | null;
  paperFeedback: PaperFeedback[];
  onRefresh: () => void;
  onToggleSaved: (id: string) => void;
  onStartReading: (paper: Paper) => void;
  onGenerateReport: (paper: Paper) => void;
  onPaperFeedback: (paper: Paper, kind: FeedbackKind) => void;
  onSelectCopilotPaper: (id: string) => void;
  onAiInput: (value: string) => void;
  onAskAi: (question?: string) => void;
  onOpenAiSettings: () => void;
  onDeepRead: () => void;
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
  const aiStatusLabel = !props.aiConnectionReady
    ? "检查中"
    : !props.aiConnection.connected
      ? "AI 未连接"
      : props.aiMode === "preview"
        ? "安全降级"
        : `${props.aiConnection.model ?? "OpenAI"} · 全文`;

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
            公开候选池只提供论文与影响力信号；兴趣、阅读反馈与主题去重全部在这台设备上计算，保留 10 篇最值得投入注意力的工作。
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
              feedback={props.paperFeedback.find(
                (item) =>
                  item.projectId === DEFAULT_PROJECT_ID
                  && canonicalPaperId(item.paperId) === canonicalPaperId(paper.id),
              )?.kind}
              onToggleSaved={props.onToggleSaved}
              onStartReading={props.onStartReading}
              onGenerateReport={props.onGenerateReport}
              onPaperFeedback={props.onPaperFeedback}
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
              <span className={`ai-status ${props.aiConnection.connected ? "openai" : "preview"}`}>
                {aiStatusLabel}
              </span>
            </div>

            <button className="ai-connection-button" type="button" onClick={props.onOpenAiSettings}>
              <span aria-hidden="true">{props.aiConnection.connected ? "●" : "○"}</span>
              {props.aiConnection.connected
                ? `${props.aiConnection.source === "session" ? "个人 OpenAI 已连接" : "共享 OpenAI 已连接"} · 管理`
                : "连接 OpenAI · 启用 PDF 全文阅读"}
            </button>

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
              {props.chat.slice(-6).map((message, index) => (
                <div key={`${message.role}-${index}`} className={`chat-message ${message.role}`}>
                  <span>{message.role === "assistant" ? "PO" : "YOU"}</span>
                  <p>{message.text}</p>
                </div>
              ))}
              {props.aiBusy ? (
                <div className="chat-message assistant typing">
                  <span>PO</span>
                  <p>正在把 arXiv PDF 全文交给模型阅读<span aria-hidden="true">…</span></p>
                </div>
              ) : null}
            </div>

            {props.lastAiRun ? (
              <div className={`ai-run-meta ${props.lastAiRun.source === "fulltext-pdf" ? "fulltext" : "preview"}`}>
                <span>
                  {props.lastAiRun.source === "fulltext-pdf" ? "PDF 全文" : "摘要预览"}
                  {props.lastAiRun.model ? ` · ${props.lastAiRun.model}` : ""}
                  {props.lastAiRun.pdfDetail === "high" ? " · 图表增强" : ""}
                </span>
                {props.lastAiRun.usage ? (
                  <small>
                    本次输入 {props.lastAiRun.usage.inputTokens.toLocaleString("zh-CN")} · 输出 {props.lastAiRun.usage.outputTokens.toLocaleString("zh-CN")} tokens
                  </small>
                ) : null}
              </div>
            ) : !props.aiConnection.connected ? (
              <p className="ai-preview-note">未连接时不会消耗 token；返回的是摘要预览，不是模型回答。</p>
            ) : null}

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
            <button className="deep-read-button" type="button" onClick={props.onDeepRead} disabled={props.aiBusy}>
              让全文 Copilot 深挖这篇论文 ↗
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

type DiscoverViewProps = {
  query: string;
  filters: SearchFilters;
  meta: SearchMeta | null;
  message: string;
  papers: Paper[];
  savedIds: Set<string>;
  readIds: Set<string>;
  loading: boolean;
  onQueryChange: (value: string) => void;
  onFilterChange: <K extends keyof SearchFilters>(
    name: K,
    value: SearchFilters[K],
  ) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onClear: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onToggleSaved: (id: string) => void;
  onStartReading: (paper: Paper) => void;
  onGenerateReport: (paper: Paper) => void;
  onUseSuggestion: (query: string) => void;
};

function DiscoverView(props: DiscoverViewProps) {
  return (
    <div className="page-wrap collection-page discover-page">
      <section className="collection-header discover-header">
        <p className="eyebrow">DISCOVER / ARXIV INDEX</p>
        <h1>从整个 arXiv 发现下一篇</h1>
        <p>
          用结构化条件组合标题、作者、摘要、分类与年份；Paper Orbit 只生成安全查询，不接受原始 arXiv 语法。
        </p>

        <form className="advanced-search" onSubmit={props.onSubmit}>
          <div className="advanced-search-main">
            <label htmlFor="discover-query">关键词、作者或 arXiv ID</label>
            <div>
              <input
                id="discover-query"
                value={props.query}
                onChange={(event) => props.onQueryChange(event.target.value)}
                placeholder="例如 world models、Fei-Fei Li、2607.08639"
                autoComplete="off"
                aria-describedby="search-status"
              />
              <button type="submit" disabled={!props.query.trim() || props.loading}>
                {props.loading ? "检索中…" : "检索 arXiv"}
              </button>
            </div>
          </div>

          <div className="advanced-search-grid">
            <label>
              <span>字段</span>
              <select
                value={props.filters.field}
                onChange={(event) =>
                  props.onFilterChange(
                    "field",
                    event.target.value as ArxivSearchField,
                  )}
              >
                <option value="all">全部字段</option>
                <option value="title">标题</option>
                <option value="author">作者</option>
                <option value="abstract">摘要</option>
              </select>
            </label>
            <label>
              <span>匹配</span>
              <select
                value={props.filters.match}
                onChange={(event) =>
                  props.onFilterChange(
                    "match",
                    event.target.value as ArxivSearchMatch,
                  )}
              >
                <option value="all">包含全部词</option>
                <option value="any">包含任一词</option>
                <option value="phrase">精确短语</option>
              </select>
            </label>
            <label className="exclude-filter">
              <span>排除词</span>
              <input
                value={props.filters.exclude}
                onChange={(event) =>
                  props.onFilterChange("exclude", event.target.value)}
                placeholder="例如 survey review"
              />
            </label>
            <label>
              <span>分类</span>
              <select
                value={props.filters.category}
                onChange={(event) =>
                  props.onFilterChange("category", event.target.value)}
              >
                <option value="">全部分类</option>
                <option value="cs.RO">cs.RO · Robotics</option>
                <option value="cs.CV">cs.CV · Computer Vision</option>
                <option value="cs.AI">cs.AI · Artificial Intelligence</option>
                <option value="cs.LG">cs.LG · Machine Learning</option>
                <option value="cs.CL">cs.CL · Language</option>
                <option value="stat.ML">stat.ML · Machine Learning</option>
                <option value="physics.comp-ph">physics.comp-ph</option>
              </select>
            </label>
            <label>
              <span>起始年份</span>
              <input
                type="number"
                inputMode="numeric"
                min="1991"
                max="2100"
                value={props.filters.fromYear}
                onChange={(event) =>
                  props.onFilterChange("fromYear", event.target.value)}
                placeholder="1991"
              />
            </label>
            <label>
              <span>结束年份</span>
              <input
                type="number"
                inputMode="numeric"
                min="1991"
                max="2100"
                value={props.filters.toYear}
                onChange={(event) =>
                  props.onFilterChange("toYear", event.target.value)}
                placeholder={String(new Date().getFullYear())}
              />
            </label>
            <label>
              <span>排序依据</span>
              <select
                value={props.filters.sort}
                onChange={(event) =>
                  props.onFilterChange(
                    "sort",
                    event.target.value as ArxivSearchSort,
                  )}
              >
                <option value="relevance">相关度</option>
                <option value="submittedDate">提交时间</option>
                <option value="lastUpdatedDate">更新时间</option>
              </select>
            </label>
            <label>
              <span>顺序</span>
              <select
                value={props.filters.order}
                onChange={(event) =>
                  props.onFilterChange(
                    "order",
                    event.target.value as ArxivSearchOrder,
                  )}
              >
                <option value="descending">降序</option>
                <option value="ascending">升序</option>
              </select>
            </label>
            <label>
              <span>每页数量</span>
              <select
                value={props.filters.limit}
                onChange={(event) =>
                  props.onFilterChange("limit", Number(event.target.value))}
              >
                {[10, 20, 30, 50].map((limit) => (
                  <option key={limit} value={limit}>{limit} 篇</option>
                ))}
              </select>
            </label>
          </div>

          <div className="advanced-search-actions">
            <button type="button" onClick={props.onClear}>清除条件</button>
            <small>修改关键词或筛选后会从第 1 页重新检索。</small>
          </div>
        </form>

        <div className="search-suggestions" aria-label="搜索建议">
          {["physical reasoning", "vision-language-action", "world models", "AI for science"].map((query) => (
            <button key={query} type="button" onClick={() => props.onUseSuggestion(query)}>
              {query} ↗
            </button>
          ))}
        </div>
        <p id="search-status" className="search-status" role="status" aria-live="polite">
          {props.message}
        </p>
      </section>

      {props.loading ? <div className="loading-rule" aria-hidden="true"><i /></div> : null}
      <section className="paper-list collection-list" aria-busy={props.loading}>
        {props.papers.length ? (
          props.papers.map((paper, index) => (
            <PaperEntry
              key={paper.id}
              paper={paper}
              index={(props.meta?.start ?? 0) + index}
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
            <p>输入主题、作者或 arXiv ID，也可以先选择一个结构化筛选条件。</p>
          </div>
        )}
      </section>

      {props.meta && props.meta.totalResults > 0 ? (
        <nav className="search-pagination" aria-label="搜索结果分页">
          <button
            type="button"
            onClick={props.onPrevious}
            disabled={!props.meta.hasPrevious || props.loading}
          >
            ← 上一页
          </button>
          <span>
            第 {Math.floor(props.meta.start / props.meta.limit) + 1} 页 · 共 {props.meta.totalResults} 篇
          </span>
          <button
            type="button"
            onClick={props.onNext}
            disabled={!props.meta.hasNext || props.loading}
          >
            下一页 →
          </button>
        </nav>
      ) : null}
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
