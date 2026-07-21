"use client";

import { FormEvent, Fragment, useEffect, useMemo, useRef, useState } from "react";
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
  DEFAULT_OPENAI_BASE_URL,
  DEFAULT_OPENAI_MODEL,
  LOCAL_OPENAI_BASE_URL,
} from "./api/ai/provider-config";
import {
  claimLegacyStorage,
  storageKeysFor,
} from "./local-user-storage";
import {
  parseMarkdown,
  type MarkdownInline,
  type MarkdownList,
} from "./markdown";

type View = "today" | "discover" | "library" | "reports";
type AiMode = "openai" | "preview";
type AiConnectionSource = "session" | "shared" | null;

type AiConnection = {
  connected: boolean;
  source: AiConnectionSource;
  baseUrl: string | null;
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
  diagnostic?: AiDiagnostic;
};

type AiDiagnostic = {
  id: string;
  category: string;
  stage: string;
  retryable: boolean;
  arxiv?: {
    available: boolean;
    status: number | null;
    contentType: string | null;
    bytes: number | null;
    elapsedMs: number;
  };
  provider?: {
    reachable: boolean | null;
    status: number | null;
    requestId: string | null;
    transport: "json" | "sse";
    elapsedMs: number;
    attempts: number;
    textProbe: "passed" | "failed" | "not-run";
  };
};

type Paper = CandidatePaper & {
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
  localDevelopment: boolean;
  role: "owner" | "manager" | "reader";
};

type ChatMessage = {
  role: "user" | "assistant";
  text: string;
  meta?: AiRunMeta;
  diagnostic?: AiDiagnostic;
  retryPrompt?: string;
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
  relevant: "Relevant",
  not_relevant: "Not relevant",
  too_broad: "Too broad",
  already_knew: "Already read / familiar",
};

const COPILOT_WELCOME: ChatMessage = {
  role: "assistant",
  text: "Connect an AI service that supports the Responses API and PDF input, and I will read the selected paper directly from its full arXiv PDF. Ask me about the core mechanism, equations, figures, experiments, or replication risks.",
};

function aiProviderLabel(baseUrl: string | null) {
  if (!baseUrl) return "AI service";
  try {
    const hostname = new URL(baseUrl).hostname;
    return hostname === "api.openai.com" ? "Official OpenAI API" : hostname;
  } catch {
    return "AI service";
  }
}

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

function paperPayload(paper: Paper) {
  const payload: Record<string, unknown> = { ...paper };
  delete payload.zhSummary;
  return payload;
}

function dateLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
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
  const suggestedApiBaseUrl = viewer.localDevelopment
    ? LOCAL_OPENAI_BASE_URL
    : DEFAULT_OPENAI_BASE_URL;
  const [activeView, setActiveView] = useState<View>("today");
  const [candidatePool, setCandidatePool] = useState<Paper[]>(SEED_PAPERS);
  const [searchResults, setSearchResults] = useState<Paper[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFilters, setSearchFilters] = useState<SearchFilters>(
    DEFAULT_SEARCH_FILTERS,
  );
  const [searchMeta, setSearchMeta] = useState<SearchMeta | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchMessage, setSearchMessage] = useState("Search by title, author, topic, or arXiv ID");
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
  const [refreshNote, setRefreshNote] = useState("Multi-signal selection · Updated daily");
  const [copilotPaperId, setCopilotPaperId] = useState(SEED_PAPERS[0].id);
  const [aiInput, setAiInput] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiMode, setAiMode] = useState<AiMode>("preview");
  const [aiConnection, setAiConnection] = useState<AiConnection>({
    connected: false,
    source: null,
    baseUrl: null,
    model: null,
    sessionAvailable: false,
  });
  const [aiConnectionReady, setAiConnectionReady] = useState(false);
  const [aiConnectionBusy, setAiConnectionBusy] = useState(false);
  const [apiBaseUrlInput, setApiBaseUrlInput] = useState(suggestedApiBaseUrl);
  const [apiModelInput, setApiModelInput] = useState(DEFAULT_OPENAI_MODEL);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [aiConnectionMessage, setAiConnectionMessage] = useState("");
  const [researchConnection, setResearchConnection] = useState<ResearchConnection>(
    DEFAULT_RESEARCH_CONNECTION,
  );
  const [researchConnectionReady, setResearchConnectionReady] = useState(false);
  const [researchConnectionBusy, setResearchConnectionBusy] = useState(false);
  const [semanticScholarKeyInput, setSemanticScholarKeyInput] = useState("");
  const [researchConnectionMessage, setResearchConnectionMessage] = useState("");
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
    if (!silent) setRefreshNote("Scanning the candidate pool and reranking…");
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
          ? "Calibrated with your influence data"
          : data.meta?.metadataCredential === "shared"
            ? "Calibrated with site influence data"
            : data.source?.includes("semantic-scholar")
              ? "Calibrated with public influence signals"
              : "Public arXiv candidate pool";
        setRefreshNote(
          `Selected locally from ${candidateCount} candidates · ${sourceLabel}`,
        );
        if (!silent) showToast("Today's 10 papers have been reranked locally");
      }
    } catch {
      setRefreshNote("Editorial cache · Updates automatically when the network returns");
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
    setSearchMessage(`Searching arXiv for “${query}”…`);
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
          ? `Showing ${first}–${last} of ${total} results`
          : "No results found. Try broader keywords or clear the filters.",
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
        local.length
          ? "Live search is unavailable; showing the editorial cache instead."
          : "Live search is unavailable. Please try again later.",
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
    setSearchMessage("Search by title, author, topic, or arXiv ID");
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
      nextKind ? "Feedback saved and recommendations reranked" : "Feedback cleared for this paper",
      "Undo",
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
    showToast("Paper feedback cleared");
  }

  function toggleSaved(id: string) {
    const paper = allPapers.find((item) => item.id === id);
    const wasSaved = savedIds.has(id);
    setSavedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
        showToast("Removed from your library");
      } else {
        next.add(id);
        showToast("Saved to your library");
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
      if (!response.ok) throw new Error(data.error || "Unable to read the AI connection status");
      setAiConnection(data);
      setApiBaseUrlInput(data.baseUrl ?? suggestedApiBaseUrl);
      setApiModelInput(data.model ?? DEFAULT_OPENAI_MODEL);
      setAiMode(data.connected ? "openai" : "preview");
    } catch {
      setAiConnectionMessage("The AI connection status is temporarily unavailable.");
    } finally {
      setAiConnectionReady(true);
    }
  }

  async function connectOpenAI(event: FormEvent) {
    event.preventDefault();
    const apiKey = apiKeyInput.trim();
    const baseUrl = apiBaseUrlInput.trim();
    const model = apiModelInput.trim();
    if (!apiKey || !baseUrl || !model || aiConnectionBusy) return;
    setAiConnectionBusy(true);
    setAiConnectionMessage("Checking /models and running a minimal live /responses inference…");
    try {
      const response = await fetch("/api/ai/session", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey, baseUrl, model }),
      });
      const data = (await response.json()) as AiConnection & { error?: string };
      if (!response.ok) throw new Error(data.error || "Unable to connect the AI service");
      setAiConnection(data);
      setApiBaseUrlInput(data.baseUrl ?? baseUrl);
      setApiModelInput(data.model ?? model);
      setAiMode("openai");
      setAiConnectionMessage(`Connected to ${aiProviderLabel(data.baseUrl)} after verifying /models and a live text-only /responses inference. PDF support is validated separately: Paper Orbit checks arXiv and tests the full-text path for each paper request.`);
      showToast("AI text path verified and connected");
    } catch (error) {
      setAiConnectionMessage(
        error instanceof Error ? error.message : "Unable to connect the AI service. Please try again later.",
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
      if (!response.ok) throw new Error(data.error || "Unable to disconnect the service");
      setAiConnection(data);
      setApiBaseUrlInput(data.baseUrl ?? suggestedApiBaseUrl);
      setApiModelInput(data.model ?? DEFAULT_OPENAI_MODEL);
      setAiMode(data.connected ? "openai" : "preview");
      setAiConnectionMessage(
        data.connected
          ? "Your personal session has been cleared. The site-configured shared OpenAI connection is still active."
          : "Your personal AI service session has been cleared from this browser.",
      );
      showToast("Personal AI service session disconnected");
    } catch (error) {
      setAiConnectionMessage(
        error instanceof Error ? error.message : "Unable to disconnect the service. Please try again later.",
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
        throw new Error(data.error || "Unable to read the paper data connection status");
      }
      setResearchConnection(data);
    } catch {
      setResearchConnectionMessage("The paper data connection status is temporarily unavailable.");
    } finally {
      setResearchConnectionReady(true);
    }
  }

  async function connectSemanticScholar(event: FormEvent) {
    event.preventDefault();
    const apiKey = semanticScholarKeyInput.trim();
    if (!apiKey || researchConnectionBusy) return;
    setResearchConnectionBusy(true);
    setResearchConnectionMessage("Validating the key and establishing an encrypted paper data session…");
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
        throw new Error(data.error || "Unable to connect Semantic Scholar");
      }
      setResearchConnection(data);
      setResearchConnectionMessage(
        "Connected. Future refreshes will use your Semantic Scholar API quota to retrieve citation-based influence signals.",
      );
      showToast("Personal paper influence data connected");
      await refreshDaily(true);
    } catch (error) {
      setResearchConnectionMessage(
        error instanceof Error
          ? error.message
          : "Unable to connect Semantic Scholar. Please try again later.",
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
        throw new Error(data.error || "Unable to disconnect the paper data service");
      }
      setResearchConnection(data);
      setResearchConnectionMessage(
        data.semanticScholar.source === "shared"
          ? "Your personal session has been cleared. Only OWNER and MANAGER accounts now use the site's shared paper metadata connection."
          : "Your personal Semantic Scholar session has been cleared from this browser. Public arXiv search remains available.",
      );
      showToast("Personal paper data session disconnected");
      await refreshDaily(true);
    } catch (error) {
      setResearchConnectionMessage(
        error instanceof Error
          ? error.message
          : "Unable to disconnect the paper data service. Please try again later.",
      );
    } finally {
      setResearchConnectionBusy(false);
    }
  }

  function selectCopilotPaper(id: string) {
    setCopilotPaperId(id);
    setChat([COPILOT_WELCOME]);
  }

  async function askAI(question?: string) {
    const prompt = (question ?? aiInput).trim();
    if (!prompt || !copilotPaper || aiBusy) return;
    const history = chat
      .filter((message) => !message.diagnostic)
      .slice(-8)
      .map(({ role, text }) => ({ role, text }));
    setAiInput("");
    setChat((current) => [...current, { role: "user", text: prompt }]);
    setAiBusy(true);
    try {
      const response = await fetch("/api/ai", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paper: paperPayload(copilotPaper),
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
        diagnostic?: AiDiagnostic;
      };
      if (!response.ok || !data.answer || !data.mode) {
        const diagnosticId = data.diagnostic?.id
          ?? response.headers.get("x-paper-orbit-diagnostic-id")
          ?? `client-${Date.now().toString(36)}`;
        const diagnostic = data.diagnostic ?? {
          id: diagnosticId,
          category: "communication",
          stage: "browser-api",
          retryable: true,
        };
        setChat((current) => [
          ...current,
          {
            role: "assistant",
            text: data.error || "This full-text analysis could not be completed.",
            diagnostic,
            retryPrompt: diagnostic.retryable ? prompt : undefined,
          },
        ]);
        return;
      }
      const answer = data.answer;
      const mode = data.mode;
      setAiMode(mode);
      const meta: AiRunMeta = {
        source: data.source ?? (mode === "openai" ? "fulltext-pdf" : "abstract-preview"),
        model: data.model ?? aiConnection.model,
        pdfDetail: data.pdfDetail,
        usage: data.usage,
        diagnostic: data.diagnostic,
      };
      setChat((current) => [
        ...current,
        { role: "assistant", text: answer, meta },
      ]);
    } catch (error) {
      const diagnostic: AiDiagnostic = {
        id: `client-${Date.now().toString(36)}`,
        category: "communication",
        stage: "browser-api",
        retryable: true,
      };
      setChat((current) => [
        ...current,
        {
          role: "assistant",
          text:
            error instanceof Error
              ? error.message
              : "This full-text analysis could not be completed. Please try again later.",
          diagnostic,
          retryPrompt: prompt,
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
    setAiBusy(true);
    showToast("Generating the reading report…");
    try {
      const response = await fetch("/api/ai", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paper: paperPayload(paper),
          action: "report",
          prompt: `Respond in English. Read the full PDF and write a natural, coherent structured report covering the research question, core method, key contributions, strength of evidence, limitations, connection to my interests, and three follow-up questions. My research interests are ${interests.join(", ")}. Synthesize the main text, equations, figures, experiments, and appendix, citing verifiable locations wherever possible. Do not translate sentence by sentence, paraphrase mechanically, or copy long passages. Clearly distinguish facts stated in the paper, reasonable inferences, and evidence the paper does not provide.`,
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
        diagnostic?: AiDiagnostic;
      };
      if (!response.ok || !data.answer || !data.mode) {
        const suffix = data.diagnostic?.id ? ` (diagnostic ID: ${data.diagnostic.id})` : "";
        throw new Error(`${data.error || "The report could not be generated."}${suffix}`);
      }
      setAiMode(data.mode);
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
      showToast("Reading report generated and saved");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "The report could not be generated. Please try again later.");
    } finally {
      setAiBusy(false);
    }
  }

  async function deepReadWithCopilot() {
    if (!copilotPaper) return;
    await askAI(
      `Respond in English. Analyze this paper in depth using the full PDF. My research interests are ${interests.join(", ")}. Focus on the core mechanism, important equations and figures, whether the evidence supports the conclusions, differences from related work, and the experiment most worth reproducing. Cite verifiable locations wherever possible.`,
    );
  }

  function saveInterests() {
    const next = draftInterests.length ? draftInterests : DEFAULT_INTERESTS;
    setInterests(next);
    localStorage.setItem(storage.interests, JSON.stringify(next));
    setSettingsOpen(false);
    setRankingNow(Date.now());
    showToast("Research interests updated and local recommendations reranked");
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
          aria-label="Paper Orbit home"
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

        <nav className="main-nav" aria-label="Main navigation">
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
              Search arXiv
            </label>
            <input
              ref={searchRef}
              id="global-search"
              value={searchQuery}
              onChange={(event) => updateSearchQuery(event.target.value)}
              placeholder="Search arXiv…"
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
            aria-label={`Edit research interests for ${viewer.displayName}`}
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
            title="Your paper library"
            description={`${savedIds.size} saved · ${readIds.size} started`}
            papers={libraryPapers}
            emptyLabel="You have not saved any papers yet. Return to Today and select “Save” to build your first reading queue."
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
            <button className="modal-close" type="button" onClick={() => setSettingsOpen(false)} aria-label="Close">
              ×
            </button>
            <p className="eyebrow">PERSONAL EDITOR</p>
            <h2 id="interest-title">Define your research orbit</h2>
            <p>
              Paper Orbit selects 10 papers each day from an expanded candidate pool. Your interests set the main trajectory, while saving, reading, and generating reports continuously refine the ranking. Choosing 2–5 areas usually works best.
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
                  Manage API connections
                </button>
                {viewer.localDevelopment ? (
                  <span className="local-viewer-note">Local development identity</span>
                ) : (
                  <a href="/signout-with-chatgpt?return_to=%2F">Switch account</a>
                )}
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
                <h3 id="feedback-history-title">Paper feedback history</h3>
              </div>
              <p>
                These signals stay in this browser. You can clear feedback here even after a paper leaves today’s list.
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
                          aria-label={`Clear feedback for ${paper?.title ?? item.paperId}`}
                        >
                          Clear
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="feedback-history-empty">No explicit paper feedback has been recorded.</p>
              )}
            </section>
            <div className="modal-actions">
              <button className="text-button" type="button" onClick={() => setSettingsOpen(false)}>
                Cancel
              </button>
              <button className="primary-button" type="button" onClick={saveInterests}>
                Save and refresh selections
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
            <button className="modal-close" type="button" onClick={() => setAiSettingsOpen(false)} aria-label="Close">
              ×
            </button>
            <p className="eyebrow">PERSONAL API CONNECTIONS / ENCRYPTED SESSION</p>
            <h2 id="ai-connect-title">Connect your research services</h2>
            <p>
              Each READER uses their own external service quota. OpenAI or a compatible provider powers the full-PDF Copilot; public arXiv search requires no key; and an optional Semantic Scholar key provides more reliable citation and influential-citation signals.
            </p>

            <section className="provider-section" aria-labelledby="openai-provider-title">
              <div className="provider-heading">
                <div>
                  <span>FULL-TEXT COPILOT</span>
                  <h3 id="openai-provider-title">OpenAI-compatible API</h3>
                </div>
                <small>Personal billing</small>
              </div>

              <div className={`ai-connection-card ${aiConnection.connected ? "connected" : ""}`}>
                <span aria-hidden="true">{aiConnection.connected ? "✓" : "○"}</span>
                <div>
                  <strong>
                    {aiConnection.connected
                      ? aiConnection.source === "session"
                        ? "AI text path verified and connected"
                        : "Shared AI configured"
                      : "No live AI connected"}
                  </strong>
                  <small>
                    {aiConnection.connected
                      ? `${aiConnection.model ?? "Unnamed model"} · ${aiProviderLabel(aiConnection.baseUrl)} · ${aiConnection.source === "session" ? `${viewer.localDevelopment ? "Local encrypted session" : "Your temporary session"} · /models and text-only /responses verified · PDF checked per paper` : "Site-wide shared connection for privileged accounts only"}`
                      : "Without a personal key, readers receive a token-free abstract preview only."}
                  </small>
                </div>
              </div>

              {aiConnection.sessionAvailable ? (
                <form className="ai-connect-form" onSubmit={connectOpenAI}>
                  <div className="ai-provider-fields">
                    <label className="ai-provider-field" htmlFor="openai-base-url">
                      <span>API Base URL</span>
                      <input
                        id="openai-base-url"
                        type="url"
                        value={apiBaseUrlInput}
                        onChange={(event) => setApiBaseUrlInput(event.target.value)}
                        placeholder={suggestedApiBaseUrl}
                        autoComplete="url"
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                        disabled={aiConnectionBusy}
                      />
                    </label>
                    <label className="ai-provider-field" htmlFor="openai-model">
                      <span>Model ID</span>
                      <input
                        id="openai-model"
                        type="text"
                        value={apiModelInput}
                        onChange={(event) => setApiModelInput(event.target.value)}
                        placeholder="gpt-5.6"
                        autoComplete="off"
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                        disabled={aiConnectionBusy}
                      />
                    </label>
                  </div>
                  <label htmlFor="openai-api-key">
                    {aiConnection.source === "session" ? "Enter an API key to replace this connection" : "Personal API key"}
                  </label>
                  <div className="ai-key-row">
                    <input
                      id="openai-api-key"
                      type="password"
                      value={apiKeyInput}
                      onChange={(event) => setApiKeyInput(event.target.value)}
                      placeholder="Your API key (no sk- prefix required)"
                      autoComplete="off"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      disabled={aiConnectionBusy}
                    />
                    <button
                      type="submit"
                      disabled={
                        !apiKeyInput.trim()
                        || !apiBaseUrlInput.trim()
                        || !apiModelInput.trim()
                        || aiConnectionBusy
                      }
                    >
                      {aiConnectionBusy ? "Connecting…" : aiConnection.source === "session" ? "Verify and replace" : "Verify and connect"}
                    </button>
                  </div>
                  <small>
                    {viewer.localDevelopment
                      ? "The Base URL, model, and key are AES-GCM encrypted in an HttpOnly cookie scoped to localhost. The local decryption secret lives in a private, Git-ignored directory. These values never enter localStorage, a database, the repository, or the production site, and are retained for at most 90 days. This mode allows loopback APIs at http://127.0.0.1 or http://localhost; every other address must still use public HTTPS."
                      : "The Base URL, model, and key are stored together in a server-encrypted HttpOnly browser session. They are never written to localStorage, a database, or the repository, and expire when the browser closes or after 12 hours. The address must be a public HTTPS API root."}
                  </small>
                  <small className="ai-provider-disclosure">
                    Verification first calls <code>/models</code>, then runs one tiny live text-only <code>/responses</code> inference that consumes a small number of tokens. This proves only that the model and text endpoint work; it does not validate PDF support. Before every paper question, Paper Orbit independently verifies the arXiv PDF and then passes it to the model through <code>input_file</code>. Custom providers use streaming Responses when possible to reduce long-request timeouts. The provider receives the paper’s PDF URL, your question, paper metadata, and recent conversation, so connect only a provider you trust.
                  </small>
                </form>
              ) : (
                <div className="ai-config-warning">
                  The server administrator must configure <code>PAPER_ORBIT_SESSION_SECRET</code> before Paper Orbit can securely accept each user’s API connection.
                </div>
              )}

              {aiConnectionMessage ? (
                <p className="ai-connection-message" role="status">{aiConnectionMessage}</p>
              ) : null}

              <div className="ai-connect-links">
                <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer">
                  Create an OpenAI API key ↗
                </a>
                <a href="https://platform.openai.com/settings/organization/billing/overview" target="_blank" rel="noreferrer">
                  View API billing ↗
                </a>
              </div>

              {aiConnection.source === "session" ? (
                <button className="provider-disconnect" type="button" onClick={() => void disconnectOpenAI()} disabled={aiConnectionBusy}>
                  Clear personal AI service session
                </button>
              ) : null}
            </section>

            <section className="provider-section" aria-labelledby="paper-data-provider-title">
              <div className="provider-heading">
                <div>
                  <span>PAPER DISCOVERY &amp; IMPACT</span>
                  <h3 id="paper-data-provider-title">Paper data APIs</h3>
                </div>
                <small>Isolated per user</small>
              </div>

              <div className="provider-status-grid">
                <div className="provider-status connected">
                  <span aria-hidden="true">✓</span>
                  <div>
                    <strong>Public arXiv API</strong>
                    <small>Search, categories, dates, and PDF URLs · No personal API key exists or is required</small>
                  </div>
                </div>
                <div className={`provider-status ${researchConnection.semanticScholar.keyConnected ? "connected" : ""}`}>
                  <span aria-hidden="true">{researchConnection.semanticScholar.keyConnected ? "✓" : "○"}</span>
                  <div>
                    <strong>
                      {researchConnection.semanticScholar.keyConnected
                        ? "Semantic Scholar key connected"
                        : "Public Semantic Scholar quota"}
                    </strong>
                    <small>
                      {!researchConnectionReady
                        ? "Checking connection status…"
                        : researchConnection.semanticScholar.source === "session"
                          ? `${viewer.localDevelopment ? "Local encrypted session" : "Your temporary session"} · Citations and influential citations`
                          : researchConnection.semanticScholar.source === "shared"
                            ? "Site-wide shared connection for privileged accounts only"
                            : "Works without a key, but shared rate limits may apply during peak traffic"}
                    </small>
                  </div>
                </div>
              </div>

              {researchConnection.semanticScholar.sessionAvailable ? (
                <form className="ai-connect-form" onSubmit={connectSemanticScholar}>
                  <label htmlFor="semantic-scholar-api-key">
                    {researchConnection.semanticScholar.source === "session"
                      ? "Replace personal Semantic Scholar API key"
                      : "Personal Semantic Scholar API key (optional)"}
                  </label>
                  <div className="ai-key-row">
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
                        ? "Connecting…"
                        : researchConnection.semanticScholar.source === "session"
                          ? "Verify and replace"
                          : "Verify and connect"}
                    </button>
                  </div>
                  <small>
                    The key is sent only by the Paper Orbit backend in Semantic Scholar’s <code>x-api-key</code> header and uses the same encrypted-session boundary as the OpenAI key.
                  </small>
                </form>
              ) : (
                <div className="ai-config-warning">
                  The server administrator must configure <code>PAPER_ORBIT_SESSION_SECRET</code> before Paper Orbit can securely accept personal paper data keys.
                </div>
              )}

              {researchConnectionMessage ? (
                <p className="ai-connection-message" role="status">{researchConnectionMessage}</p>
              ) : null}

              <div className="ai-connect-links">
                <a href="https://info.arxiv.org/help/api/user-manual.html" target="_blank" rel="noreferrer">
                  arXiv API documentation ↗
                </a>
                <a href="https://www.semanticscholar.org/product/api" target="_blank" rel="noreferrer">
                  Request a Semantic Scholar API key ↗
                </a>
              </div>

              {researchConnection.semanticScholar.source === "session" ? (
                <button className="provider-disconnect" type="button" onClick={() => void disconnectSemanticScholar()} disabled={researchConnectionBusy}>
                  Clear personal paper data session
                </button>
              ) : null}
            </section>

            <div className="modal-actions ai-modal-actions">
              <span>
                {viewer.localDevelopment
                  ? "All personal keys stay in local encrypted sessions for at most 90 days and can be cleared at any time."
                  : "All personal keys are bound to the current ChatGPT sign-in email and expire after 12 hours."}
              </span>
              <button className="primary-button" type="button" onClick={() => setAiSettingsOpen(false)}>
                Done
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
            <button className="modal-close" type="button" onClick={() => setActiveReport(null)} aria-label="Close">
              ×
            </button>
            <p className="eyebrow">READING REPORT / {activeReport.paperId}</p>
            <h2 id="report-title">{activeReport.paperTitle}</h2>
            <div className="report-meta">
              {new Date(activeReport.createdAt).toLocaleString("en-US")} · {activeReport.mode === "openai" ? "OpenAI full-PDF analysis" : "Abstract-assisted mode"}
            </div>
            <div className="report-content markdown-body">
              <MarkdownText text={activeReport.content} />
            </div>
            <div className="modal-actions">
              <button className="text-button" type="button" onClick={() => navigator.clipboard.writeText(activeReport.content)}>
                Copy report
              </button>
              <button className="primary-button" type="button" onClick={() => downloadReport(activeReport)}>
                Download Markdown
              </button>
            </div>
          </article>
        </div>
      ) : null}

      <div className={`toast ${toast ? "visible" : ""}`} role="status" aria-live="polite">
        <span>{toast?.message}</span>
        {toast?.onAction ? (
          <button type="button" onClick={toast.onAction}>
            {toast.actionLabel ?? "Undo"}
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
        <p>{paper.summary}</p>
        <div className="paper-byline">
          {paper.authors.slice(0, 4).join(" · ")}
          {paper.authors.length > 4 ? " et al." : ""}
        </div>
        {recommendation && onPaperFeedback ? (
          <details className="recommendation-details">
            <summary>Why this paper</summary>
            <p>{recommendation.reason}</p>
            <div className="signal-grid" aria-label="Recommendation signals, scored out of 100">
              {(
                [
                  ["Relevance", recommendation.signals.relevance],
                  ["Local affinity", recommendation.signals.affinity],
                  ["Freshness", recommendation.signals.freshness],
                  ["Influence", recommendation.signals.influence],
                  ["Evidence", recommendation.signals.evidence],
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
                <dt>Citations</dt>
                <dd>{recommendation.citationCount ?? "—"}</dd>
              </div>
              <div>
                <dt>Influential citations</dt>
                <dd>{recommendation.influentialCitationCount ?? "—"}</dd>
              </div>
              <div>
                <dt>Diversity exploration</dt>
                <dd>{recommendation.exploration ? "Yes" : "No"}</dd>
              </div>
            </dl>
            <div className="paper-feedback" role="group" aria-label={`Rate the recommendation quality for ${paper.title}`}>
              {(Object.keys(FEEDBACK_LABELS) as FeedbackKind[]).map((kind) => (
                <button
                  key={kind}
                  type="button"
                  aria-pressed={feedback === kind}
                  className={feedback === kind ? "selected" : ""}
                  onClick={() => onPaperFeedback(paper, kind)}
                  title={feedback === kind ? "Select again to clear" : undefined}
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
          <div className="score-line" aria-label={`Recommendation score: ${paper.score}`}>
            <i style={{ width: `${paper.score}%` }} />
          </div>
          <small className="score-reason">
            {paper.recommendation?.reason ?? "Ranked by interests, recency, and research signals"}
          </small>
        </div>
        <span className="read-time">About {paper.minutes} min</span>
        <div className="paper-actions">
          <button
            className={`save-button ${saved ? "saved" : ""}`}
            type="button"
            aria-pressed={saved}
            onClick={() => onToggleSaved(paper.id)}
          >
            {saved ? "✓ Saved" : "+ Save"}
          </button>
          <button className="report-button" type="button" onClick={() => onGenerateReport(paper)}>
            Generate report
          </button>
          <button className="read-button" type="button" onClick={() => onStartReading(paper)}>
            {reading ? "Continue reading ↗" : "Start reading ↗"}
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

function formatPdfBytes(bytes: number | null | undefined) {
  if (typeof bytes !== "number" || !Number.isFinite(bytes) || bytes < 0) return "Unknown size";
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function renderMarkdownInline(nodes: MarkdownInline[], keyPrefix: string) {
  return nodes.map((node, index) => {
    const key = `${keyPrefix}-${index}`;
    switch (node.type) {
      case "strong":
        return <strong key={key}>{renderMarkdownInline(node.children, key)}</strong>;
      case "em":
        return <em key={key}>{renderMarkdownInline(node.children, key)}</em>;
      case "code":
        return <code key={key}>{node.text}</code>;
      case "math":
        return <code key={key} className="md-math-inline">{node.tex}</code>;
      case "link":
        return (
          <a key={key} href={node.href} target="_blank" rel="noopener noreferrer">
            {renderMarkdownInline(node.children, key)}
          </a>
        );
      default:
        return <Fragment key={key}>{node.text}</Fragment>;
    }
  });
}

function renderMarkdownLines(lines: MarkdownInline[][], keyPrefix: string) {
  return lines.map((line, index) => (
    <Fragment key={`${keyPrefix}-l${index}`}>
      {index > 0 ? <br /> : null}
      {renderMarkdownInline(line, `${keyPrefix}-l${index}`)}
    </Fragment>
  ));
}

function MarkdownListView({ list, keyPrefix }: { list: MarkdownList; keyPrefix: string }) {
  const ListTag = list.ordered ? "ol" : "ul";
  return (
    <ListTag start={list.ordered && list.start !== 1 ? list.start : undefined}>
      {list.items.map((item, index) => {
        const itemKey = `${keyPrefix}-i${index}`;
        return (
          <li key={itemKey}>
            {renderMarkdownLines(item.lines, itemKey)}
            {item.child ? <MarkdownListView list={item.child} keyPrefix={`${itemKey}c`} /> : null}
          </li>
        );
      })}
    </ListTag>
  );
}

function MarkdownText({ text }: { text: string }) {
  const blocks = useMemo(() => parseMarkdown(text), [text]);
  return (
    <>
      {blocks.map((block, index) => {
        const key = `md-${index}`;
        switch (block.type) {
          case "heading": {
            const HeadingTag = `h${Math.min(6, block.level + 2)}` as "h3" | "h4" | "h5" | "h6";
            return <HeadingTag key={key}>{renderMarkdownInline(block.children, key)}</HeadingTag>;
          }
          case "paragraph":
            return <p key={key}>{renderMarkdownLines(block.lines, key)}</p>;
          case "quote":
            return <blockquote key={key}>{renderMarkdownLines(block.lines, key)}</blockquote>;
          case "code":
            return (
              <pre key={key}>
                <code>{block.text}</code>
              </pre>
            );
          case "math":
            return <pre key={key} className="md-math">{block.tex}</pre>;
          case "rule":
            return <hr key={key} />;
          case "table":
            return (
              <div key={key} className="md-table-wrap">
                <table>
                  <thead>
                    <tr>
                      {block.header.map((cell, column) => (
                        <th key={`${key}-h${column}`}>
                          {renderMarkdownInline(cell, `${key}-h${column}`)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.map((row, rowIndex) => (
                      <tr key={`${key}-r${rowIndex}`}>
                        {row.map((cell, column) => (
                          <td key={`${key}-r${rowIndex}c${column}`}>
                            {renderMarkdownInline(cell, `${key}-r${rowIndex}c${column}`)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          case "list":
            return <MarkdownListView key={key} list={block} keyPrefix={key} />;
          default:
            return null;
        }
      })}
    </>
  );
}

function diagnosticTitle(category: string) {
  if (category === "arxiv") return "arXiv PDF retrieval failed";
  if (category === "authentication") return "API authentication failed";
  if (category === "quota") return "AI service quota or rate limit";
  if (category === "provider-pdf") return "AI service PDF support is incompatible";
  if (category === "compatibility") return "AI API compatibility failure";
  if (category === "communication") return "Browser connection to Paper Orbit interrupted";
  return "AI full-text processing failed";
}

function TodayView(props: TodayViewProps) {
  const chatWindowRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const chatWindow = chatWindowRef.current;
    if (chatWindow) chatWindow.scrollTop = chatWindow.scrollHeight;
  }, [props.chat, props.aiBusy]);

  const completedThisWeek = Math.min(props.readIds.size, 10);
  const progress = Math.min(100, Math.max(10, completedThisWeek * 10));
  const quickPrompts = [
    "Explain the core contribution in three sentences",
    "Compare it with representative work in the field",
    "Identify the experiment most worth reproducing",
  ];
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
  const fulltextVerified = props.chat.some(
    (message) => message.meta?.source === "fulltext-pdf",
  );
  const aiStatusLabel = !props.aiConnectionReady
    ? "Checking"
    : !props.aiConnection.connected
      ? "AI not connected"
      : props.aiMode === "preview"
        ? "Safe fallback"
        : fulltextVerified
          ? `${props.aiConnection.model ?? "OpenAI"} · Full text verified`
          : `${props.aiConnection.model ?? "OpenAI"} · Text verified`;

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
          <h1><em>{props.feed.length}</em> papers worth reading today</h1>
          <p className="edition-deck">
            The public candidate pool provides only papers and influence signals. Your interests, reading feedback, and topic diversity are computed entirely on this device to select the 10 papers most worthy of your attention.
          </p>
        </div>
        <div className="edition-controls">
          <span>{props.refreshNote}</span>
          <button type="button" onClick={props.onRefresh} disabled={props.refreshing}>
            {props.refreshing ? "Scanning…" : "Refresh today's selection ↻"}
          </button>
        </div>
        <div className="interest-strip" aria-label="Current research interests">
          {props.interests.map((interest) => (
            <span key={interest}>{interest}</span>
          ))}
        </div>
      </section>

      <div className="content-grid">
        <section className="paper-list" aria-labelledby="today-papers">
          <h2 id="today-papers" className="sr-only">
            Today’s papers
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
                ? `${props.aiConnection.source === "session" ? "Personal AI connected" : "Shared OpenAI connected"} · Manage`
                : "Connect an AI service · Enable full-PDF reading"}
            </button>

            <label className="paper-select-label" htmlFor="copilot-paper">
              Current paper
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

            <div className="chat-window" aria-live="polite" ref={chatWindowRef}>
              {props.chat.slice(-6).map((message, index) => (
                <div key={`${message.role}-${index}`} className={`chat-message ${message.role}`}>
                  <span>{message.role === "assistant" ? "PO" : "YOU"}</span>
                  <div className="chat-message-body">
                    {message.role === "assistant" ? (
                      <div className="markdown-body">
                        <MarkdownText text={message.text} />
                      </div>
                    ) : (
                      <p>{message.text}</p>
                    )}
                    {message.meta ? (
                      <div className={`ai-run-meta ${message.meta.source === "fulltext-pdf" ? "fulltext" : "preview"}`}>
                        <span>
                          {message.meta.source === "fulltext-pdf" ? "Full PDF" : "Abstract preview"}
                          {message.meta.model ? ` · ${message.meta.model}` : ""}
                          {message.meta.pdfDetail === "high" ? " · Enhanced figure detail" : ""}
                        </span>
                        {message.meta.usage ? (
                          <small>
                            Input {message.meta.usage.inputTokens.toLocaleString("en-US")} · Output {message.meta.usage.outputTokens.toLocaleString("en-US")} tokens
                          </small>
                        ) : null}
                        {message.meta.diagnostic?.arxiv?.available ? (
                          <small>
                            arXiv verified · {formatPdfBytes(message.meta.diagnostic.arxiv.bytes)}
                            {message.meta.diagnostic.provider?.transport === "sse" ? " · Streaming transport" : ""}
                            {(message.meta.diagnostic.provider?.attempts ?? 1) > 1
                              ? ` · Recovered after ${message.meta.diagnostic.provider?.attempts} attempts`
                              : ""}
                          </small>
                        ) : null}
                      </div>
                    ) : null}
                    {message.diagnostic ? (
                      <div className="ai-diagnostic" role="status">
                        <strong>{diagnosticTitle(message.diagnostic.category)}</strong>
                        <ul>
                          {message.diagnostic.arxiv ? (
                            <li>
                              arXiv: {message.diagnostic.arxiv.available
                                ? `PDF available (${formatPdfBytes(message.diagnostic.arxiv.bytes)})`
                                : `PDF verification failed${message.diagnostic.arxiv.status ? ` (HTTP ${message.diagnostic.arxiv.status})` : ""}`}
                            </li>
                          ) : null}
                          {message.diagnostic.provider ? (
                            <li>
                              AI service: {message.diagnostic.provider.textProbe === "passed"
                                ? "Text connection is healthy, but this full-text request failed"
                                : message.diagnostic.provider.textProbe === "failed"
                                  ? "The text probe also failed; the service or its upstream is currently unavailable"
                                  : message.diagnostic.provider.status
                                    ? `The full-text request returned HTTP ${message.diagnostic.provider.status}`
                                    : "The full-text request did not complete"}
                            </li>
                          ) : null}
                          <li>Diagnostic ID: {message.diagnostic.id}</li>
                        </ul>
                        {message.retryPrompt && message.diagnostic.retryable ? (
                          <button type="button" onClick={() => props.onAskAi(message.retryPrompt)} disabled={props.aiBusy}>
                            Retry this question
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
              {props.aiBusy ? (
                <div className="chat-message assistant typing">
                  <span>PO</span>
                  <p>Verifying the arXiv PDF and sending it to the model through a stable connection. Long papers may take 1–3 minutes<span aria-hidden="true">…</span></p>
                </div>
              ) : null}
            </div>

            {!props.aiConnection.connected ? (
              <p className="ai-preview-note">No tokens are consumed while disconnected. Responses are abstract previews, not model-generated answers.</p>
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
                Ask the paper assistant
              </label>
              <textarea
                id="ai-question"
                value={props.aiInput}
                onChange={(event) => props.onAiInput(event.target.value)}
                onKeyDown={(event) => {
                  // Enter sends; Shift+Enter keeps the newline. An Enter that
                  // confirms an IME composition must never send the draft.
                  if (
                    event.key === "Enter"
                    && !event.shiftKey
                    && !event.nativeEvent.isComposing
                  ) {
                    event.preventDefault();
                    props.onAskAi();
                  }
                }}
                placeholder="Ask about the paper's method, equations, experiments, or limitations… (Enter to send, Shift+Enter for a new line)"
                rows={3}
              />
              <button type="submit" disabled={!props.aiInput.trim() || props.aiBusy} aria-label="Send question">
                ↑
              </button>
            </form>
            <button className="deep-read-button" type="button" onClick={props.onDeepRead} disabled={props.aiBusy}>
              Ask the full-text Copilot for a deep analysis ↗
            </button>
          </section>

          <section className="weekly-progress" aria-labelledby="progress-title">
            <div className="aside-heading compact">
              <div>
                <p>WEEK 29 / READING LOG</p>
                <h2 id="progress-title">This week’s reading progress</h2>
              </div>
              <strong>{completedThisWeek}/10</strong>
            </div>
            <div className="week-days" aria-label={`${completedThisWeek} papers completed this week`}>
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
              <div><strong>{props.readIds.size}</strong><span>Started</span></div>
              <div><strong>{props.savedIds.size}</strong><span>To read</span></div>
              <div><strong>{props.reports.length}</strong><span>Reports</span></div>
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
        <h1>Discover your next paper across arXiv</h1>
        <p>
          Combine title, author, abstract, category, and year with structured filters. Paper Orbit generates safe queries and does not accept raw arXiv query syntax.
        </p>

        <form className="advanced-search" onSubmit={props.onSubmit}>
          <div className="advanced-search-main">
            <label htmlFor="discover-query">Keywords, author, or arXiv ID</label>
            <div>
              <input
                id="discover-query"
                value={props.query}
                onChange={(event) => props.onQueryChange(event.target.value)}
                placeholder="For example: world models, Fei-Fei Li, or 2607.08639"
                autoComplete="off"
                aria-describedby="search-status"
              />
              <button type="submit" disabled={!props.query.trim() || props.loading}>
                {props.loading ? "Searching…" : "Search arXiv"}
              </button>
            </div>
          </div>

          <div className="advanced-search-grid">
            <label>
              <span>Field</span>
              <select
                value={props.filters.field}
                onChange={(event) =>
                  props.onFilterChange(
                    "field",
                    event.target.value as ArxivSearchField,
                  )}
              >
                <option value="all">All fields</option>
                <option value="title">Title</option>
                <option value="author">Author</option>
                <option value="abstract">Abstract</option>
              </select>
            </label>
            <label>
              <span>Match</span>
              <select
                value={props.filters.match}
                onChange={(event) =>
                  props.onFilterChange(
                    "match",
                    event.target.value as ArxivSearchMatch,
                  )}
              >
                <option value="all">All terms</option>
                <option value="any">Any term</option>
                <option value="phrase">Exact phrase</option>
              </select>
            </label>
            <label className="exclude-filter">
              <span>Exclude terms</span>
              <input
                value={props.filters.exclude}
                onChange={(event) =>
                  props.onFilterChange("exclude", event.target.value)}
                placeholder="For example: survey review"
              />
            </label>
            <label>
              <span>Category</span>
              <select
                value={props.filters.category}
                onChange={(event) =>
                  props.onFilterChange("category", event.target.value)}
              >
                <option value="">All categories</option>
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
              <span>From year</span>
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
              <span>To year</span>
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
              <span>Sort by</span>
              <select
                value={props.filters.sort}
                onChange={(event) =>
                  props.onFilterChange(
                    "sort",
                    event.target.value as ArxivSearchSort,
                  )}
              >
                <option value="relevance">Relevance</option>
                <option value="submittedDate">Submission date</option>
                <option value="lastUpdatedDate">Last updated</option>
              </select>
            </label>
            <label>
              <span>Order</span>
              <select
                value={props.filters.order}
                onChange={(event) =>
                  props.onFilterChange(
                    "order",
                    event.target.value as ArxivSearchOrder,
                  )}
              >
                <option value="descending">Descending</option>
                <option value="ascending">Ascending</option>
              </select>
            </label>
            <label>
              <span>Results per page</span>
              <select
                value={props.filters.limit}
                onChange={(event) =>
                  props.onFilterChange("limit", Number(event.target.value))}
              >
                {[10, 20, 30, 50].map((limit) => (
                  <option key={limit} value={limit}>{limit} papers</option>
                ))}
              </select>
            </label>
          </div>

          <div className="advanced-search-actions">
            <button type="button" onClick={props.onClear}>Clear filters</button>
            <small>Changing the query or filters restarts the search from page 1.</small>
          </div>
        </form>

        <div className="search-suggestions" aria-label="Search suggestions">
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
            <h2>The index is still empty</h2>
            <p>Enter a topic, author, or arXiv ID, or begin by choosing a structured filter.</p>
          </div>
        )}
      </section>

      {props.meta && props.meta.totalResults > 0 ? (
        <nav className="search-pagination" aria-label="Search result pagination">
          <button
            type="button"
            onClick={props.onPrevious}
            disabled={!props.meta.hasPrevious || props.loading}
          >
            ← Previous
          </button>
          <span>
            Page {Math.floor(props.meta.start / props.meta.limit) + 1} · {props.meta.totalResults} papers total
          </span>
          <button
            type="button"
            onClick={props.onNext}
            disabled={!props.meta.hasNext || props.loading}
          >
            Next →
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
            <h2>The index is still empty</h2>
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
        <h1>Turn reading into knowledge you can revisit</h1>
        <p>{reports.length} reports are stored on this device and can be opened or exported as Markdown at any time.</p>
      </section>
      {reports.length ? (
        <div className="report-index">
          {reports.map((report, index) => (
            <article key={report.id}>
              <div className="report-number">{String(index + 1).padStart(2, "0")}</div>
              <div>
                <p>{report.paperId} · {new Date(report.createdAt).toLocaleDateString("en-US")}</p>
                <h2>{report.paperTitle}</h2>
                <span>{report.mode === "openai" ? "OpenAI deep analysis" : "Abstract-assisted mode"}</span>
              </div>
              <div className="report-actions">
                <button type="button" onClick={() => onOpen(report)}>Open report</button>
                <button type="button" onClick={() => onDownload(report)}>Download .md</button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state report-empty">
          <span aria-hidden="true">¶</span>
          <h2>No reading reports yet</h2>
          <p>Select “Generate report” beside any paper and Paper Copilot will organize its question, method, contributions, evidence, and follow-up questions.</p>
          <button className="primary-button" type="button" onClick={onGoToday}>Return to today’s selection</button>
        </div>
      )}
    </div>
  );
}
