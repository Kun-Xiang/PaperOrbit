export type CandidatePaper = {
  id: string;
  title: string;
  authors: string[];
  summary: string;
  published: string;
  updated?: string;
  comment?: string;
  category: string;
  categories: string[];
  minutes: number;
  url: string;
  pdfUrl: string;
  tags: string[];
};

export type InfluenceSignal = {
  citationCount: number;
  influentialCitationCount: number;
};

export type RecommendationDetails = {
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

export type RecommendedPaper = CandidatePaper & {
  score: number;
  recommendation: RecommendationDetails;
};

export type FeedbackKind =
  | "relevant"
  | "not_relevant"
  | "too_broad"
  | "already_knew";

export type PaperFeedback = {
  paperId: string;
  kind: FeedbackKind;
  updatedAt: string;
  projectId: string;
};

export type AffinitySignal = {
  value: number;
  updatedAt: string;
};

export type AffinityProfileV3 = {
  version: 3;
  signals: Record<string, AffinitySignal>;
};

export const AFFINITY_STORAGE_KEY = "paper-orbit:affinity-v3";
export const LEGACY_AFFINITY_STORAGE_KEY = "paper-orbit:affinity-v2";
export const FEEDBACK_STORAGE_KEY = "paper-orbit:paper-feedback-v1";
export const DEFAULT_PROJECT_ID = "default";
export const AFFINITY_HALF_LIFE_DAYS = 90;

export const ORBIT_V2_WEIGHTS = {
  relevance: 0.42,
  affinity: 0.12,
  freshness: 0.16,
  influence: 0.17,
  evidence: 0.13,
} as const;

export const ORBIT_DIVERSITY_WEIGHTS = {
  similarity: 0.16,
  repeatedCategory: 0.025,
} as const;

export const LOCAL_FEEDBACK_WEIGHTS: Record<FeedbackKind, {
  exact: number;
  related: number;
}> = {
  relevant: { exact: 0.12, related: 0.18 },
  not_relevant: { exact: -0.62, related: -0.34 },
  too_broad: { exact: -0.34, related: -0.18 },
  already_knew: { exact: -0.42, related: 0 },
};

type InterestProfile = {
  categories: string[];
  keywords: string[];
  queryTerms: string[];
};

const INTEREST_PROFILES: Record<string, InterestProfile> = {
  "Physical AI": {
    categories: ["cs.RO", "cs.AI", "cs.LG", "cs.CV"],
    keywords: [
      "physical ai",
      "physical intelligence",
      "physics-aware",
      "robot",
      "dynamics",
      "control",
      "sim-to-real",
    ],
    queryTerms: ["robot", "dynamics", "control", "physics"],
  },
  "Multimodal Reasoning": {
    categories: ["cs.CV", "cs.CL", "cs.AI", "cs.LG"],
    keywords: [
      "multimodal reasoning",
      "visual reasoning",
      "vision-language",
      "multimodal",
      "vlm",
      "mllm",
      "grounded reasoning",
    ],
    queryTerms: ["multimodal", "reasoning", "vision-language", "vlm"],
  },
  "Embodied Intelligence": {
    categories: ["cs.RO", "cs.AI", "cs.LG", "cs.CV"],
    keywords: [
      "embodied intelligence",
      "embodied ai",
      "manipulation",
      "navigation",
      "robot learning",
      "locomotion",
      "policy learning",
      "physical interaction",
    ],
    queryTerms: ["embodied", "manipulation", "navigation", "locomotion", "policy"],
  },
  "World Models": {
    categories: ["cs.CV", "cs.AI", "cs.LG", "cs.RO"],
    keywords: [
      "world model",
      "video generation",
      "predictive model",
      "scene dynamics",
      "simulation",
      "4d generation",
      "video prediction",
    ],
    queryTerms: ["world", "video", "simulation", "dynamics", "generation"],
  },
  "AI for Science": {
    categories: ["cs.AI", "cs.LG", "physics.comp-ph", "stat.ML"],
    keywords: [
      "ai for science",
      "scientific discovery",
      "physics",
      "chemistry",
      "biology",
      "equation",
      "theorem",
      "scientific",
    ],
    queryTerms: ["scientific", "physics", "chemistry", "equation", "discovery"],
  },
  "Vision-Language Models": {
    categories: ["cs.CV", "cs.CL", "cs.AI"],
    keywords: [
      "vision-language model",
      "vision language model",
      "vlm",
      "mllm",
      "visual instruction",
      "image-text",
      "multimodal model",
    ],
    queryTerms: ["vision-language", "vlm", "multimodal", "image-text"],
  },
  "Robot Learning": {
    categories: ["cs.RO", "cs.LG", "cs.AI"],
    keywords: [
      "robot learning",
      "robot policy",
      "imitation learning",
      "reinforcement learning",
      "manipulation",
      "robot control",
      "action policy",
    ],
    queryTerms: ["robot", "policy", "imitation", "reinforcement", "manipulation"],
  },
  "Mechanistic Interpretability": {
    categories: ["cs.LG", "cs.AI", "cs.CL"],
    keywords: [
      "mechanistic interpretability",
      "circuit",
      "representation analysis",
      "feature attribution",
      "activation patching",
      "model internals",
    ],
    queryTerms: ["interpretability", "circuit", "representation", "attribution"],
  },
};

export const SUPPORTED_RESEARCH_DIRECTIONS = Object.freeze(
  Object.keys(INTEREST_PROFILES),
);

const EVIDENCE_GROUPS = [
  ["extensive experiment", "comprehensive experiment", "ablation", "benchmark"],
  ["real-world", "real world", "closed-loop", "physical robot", "user study"],
  ["open-source", "open source", "code will", "code is", "dataset will", "project page"],
  ["theoretical analysis", "formal analysis", "we prove", "theorem", "guarantee"],
  ["outperform", "state-of-the-art", "strong baseline", "cross-dataset", "generalization"],
];

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "based",
  "by",
  "for",
  "from",
  "in",
  "is",
  "model",
  "models",
  "of",
  "on",
  "the",
  "to",
  "towards",
  "using",
  "via",
  "with",
]);

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[-_/]+/g, " ").replace(/\s+/g, " ").trim();
}

function includesTerm(haystack: string, needle: string) {
  const normalizedNeedle = normalize(needle);
  if (!normalizedNeedle) return false;
  const expression = normalizedNeedle
    .split(" ")
    .map((token) => token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("\\s+");
  return new RegExp(`(?:^|\\b)${expression}(?:\\b|$)`, "i").test(haystack);
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function profileFor(interest: string): InterestProfile {
  const known = INTEREST_PROFILES[interest];
  if (known) return known;
  const normalized = normalize(interest);
  return {
    categories: [],
    keywords: unique([
      normalized,
      ...normalized.split(" ").filter((token) => token.length > 2),
    ]),
    queryTerms: normalized.split(" ").filter((token) => token.length > 2),
  };
}

export function buildFeedQuery(interests: string[]) {
  const profiles = interests.map(profileFor);
  const categories = unique(profiles.flatMap((profile) => profile.categories)).slice(0, 10);
  const queryTerms = unique(profiles.flatMap((profile) => profile.queryTerms)).slice(0, 18);
  const categoryQuery = (categories.length ? categories : ["cs.RO", "cs.CV", "cs.AI", "cs.LG"])
    .map((category) => `cat:${category}`)
    .join(" OR ");
  const topicQuery = (queryTerms.length ? queryTerms : ["robot", "multimodal", "reasoning", "embodied", "video"])
    .map((term) => `all:${term}`)
    .join(" OR ");
  return `(${categoryQuery}) AND (${topicQuery})`;
}

export function buildGenericFeedQuery() {
  const profiles = SUPPORTED_RESEARCH_DIRECTIONS.map(profileFor);
  const categories = unique(
    profiles.flatMap((profile) => profile.categories),
  );
  const queryTerms = unique(
    profiles.flatMap((profile) => profile.queryTerms),
  );
  const categoryQuery = categories
    .map((category) => `cat:${category}`)
    .join(" OR ");
  const topicQuery = queryTerms
    .map((term) => `all:${term}`)
    .join(" OR ");
  return `(${categoryQuery}) AND (${topicQuery})`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function safeTimestamp(value: unknown, fallback: string) {
  if (typeof value !== "string") return fallback;
  return Number.isFinite(new Date(value).getTime()) ? value : fallback;
}

function emptyAffinityProfile(): AffinityProfileV3 {
  return { version: 3, signals: {} };
}

function normalizeAffinityProfile(
  value: unknown,
  fallbackTimestamp: string,
): AffinityProfileV3 | null {
  if (!isRecord(value) || value.version !== 3 || !isRecord(value.signals)) {
    return null;
  }
  const signals: Record<string, AffinitySignal> = {};
  for (const [name, rawSignal] of Object.entries(value.signals)) {
    if (!name.trim() || !isRecord(rawSignal)) continue;
    const rawValue = rawSignal.value;
    if (typeof rawValue !== "number" || !Number.isFinite(rawValue)) continue;
    signals[name.slice(0, 100)] = {
      value: Number(clamp(rawValue, -12, 12).toFixed(3)),
      updatedAt: safeTimestamp(rawSignal.updatedAt, fallbackTimestamp),
    };
  }
  return { version: 3, signals };
}

export function loadAffinityProfile(
  v3Raw: string | null,
  legacyV2Raw: string | null,
  now = new Date(),
) {
  const timestamp = now.toISOString();
  if (v3Raw !== null) {
    try {
      return {
        profile:
          normalizeAffinityProfile(JSON.parse(v3Raw), timestamp)
          ?? emptyAffinityProfile(),
        migrated: false,
      };
    } catch {
      return { profile: emptyAffinityProfile(), migrated: false };
    }
  }

  const signals: Record<string, AffinitySignal> = {};
  try {
    const legacy = legacyV2Raw ? JSON.parse(legacyV2Raw) : {};
    if (isRecord(legacy)) {
      for (const [name, rawValue] of Object.entries(legacy)) {
        if (
          !name.trim()
          || typeof rawValue !== "number"
          || !Number.isFinite(rawValue)
        ) {
          continue;
        }
        signals[name.slice(0, 100)] = {
          value: Number(clamp(rawValue, -12, 12).toFixed(3)),
          updatedAt: timestamp,
        };
      }
    }
  } catch {
    // Corrupt legacy storage safely becomes a fresh local profile.
  }
  return { profile: { version: 3 as const, signals }, migrated: true };
}

export function decayedAffinityValue(
  signal: AffinitySignal,
  now = new Date(),
) {
  const updatedAt = new Date(signal.updatedAt).getTime();
  if (!Number.isFinite(updatedAt)) return signal.value;
  const ageDays = Math.max(0, (now.getTime() - updatedAt) / 86_400_000);
  return signal.value * 2 ** (-ageDays / AFFINITY_HALF_LIFE_DAYS);
}

function affinitySignalsForPaper(paper: CandidatePaper) {
  return unique([
    paper.category,
    ...paper.categories,
    ...paper.tags,
  ]).slice(0, 20);
}

export function adjustAffinityProfile(
  profile: AffinityProfileV3,
  paper: CandidatePaper,
  delta: number,
  now = new Date(),
): AffinityProfileV3 {
  const timestamp = now.toISOString();
  const signals = { ...profile.signals };
  for (const name of affinitySignalsForPaper(paper)) {
    const current = signals[name]
      ? decayedAffinityValue(signals[name], now)
      : 0;
    const value = clamp(current + delta, -12, 12);
    if (Math.abs(value) <= 0.05) delete signals[name];
    else {
      signals[name] = {
        value: Number(value.toFixed(3)),
        updatedAt: timestamp,
      };
    }
  }
  return { version: 3, signals };
}

const FEEDBACK_KINDS = new Set<FeedbackKind>([
  "relevant",
  "not_relevant",
  "too_broad",
  "already_knew",
]);

export function parseFeedbackStorage(raw: string | null): PaperFeedback[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const latest = new Map<string, PaperFeedback>();
    for (const item of parsed) {
      if (!isRecord(item)) continue;
      const paperId = typeof item.paperId === "string"
        ? item.paperId.trim().slice(0, 100)
        : "";
      const kind = item.kind;
      const projectId = typeof item.projectId === "string"
        ? item.projectId.trim().slice(0, 80)
        : DEFAULT_PROJECT_ID;
      if (!paperId || typeof kind !== "string" || !FEEDBACK_KINDS.has(kind as FeedbackKind)) {
        continue;
      }
      const feedback: PaperFeedback = {
        paperId,
        kind: kind as FeedbackKind,
        projectId: projectId || DEFAULT_PROJECT_ID,
        updatedAt: safeTimestamp(item.updatedAt, new Date(0).toISOString()),
      };
      const key = `${feedback.projectId}:${feedback.paperId}`;
      const previous = latest.get(key);
      if (!previous || previous.updatedAt <= feedback.updatedAt) {
        latest.set(key, feedback);
      }
    }
    return Array.from(latest.values()).sort(
      (left, right) => right.updatedAt.localeCompare(left.updatedAt),
    );
  } catch {
    return [];
  }
}

export function upsertPaperFeedback(
  feedback: PaperFeedback[],
  paperId: string,
  kind: FeedbackKind | null,
  now = new Date(),
  projectId = DEFAULT_PROJECT_ID,
) {
  const next = feedback.filter(
    (item) => item.paperId !== paperId || item.projectId !== projectId,
  );
  if (kind) {
    next.unshift({ paperId, kind, projectId, updatedAt: now.toISOString() });
  }
  return next;
}

function interestMatch(paper: CandidatePaper, interest: string) {
  const profile = profileFor(interest);
  const title = normalize(paper.title);
  const summary = normalize(paper.summary);
  const matchedKeywords: string[] = [];
  let raw = 0;

  for (const keyword of profile.keywords) {
    const normalizedKeyword = normalize(keyword);
    if (!normalizedKeyword) continue;
    if (includesTerm(title, normalizedKeyword)) {
      raw += 3.2;
      matchedKeywords.push(keyword);
    } else if (includesTerm(summary, normalizedKeyword)) {
      raw += 1.15;
      matchedKeywords.push(keyword);
    }
  }

  const categoryHits = paper.categories.filter((category) => profile.categories.includes(category)).length;
  raw += Math.min(2, categoryHits) * 1.25;
  return {
    strength: clamp(raw / 11),
    matched: matchedKeywords.length > 0,
  };
}

function affinityScore(paper: CandidatePaper, affinityTerms: string[]) {
  if (!affinityTerms.length) return 0.45;
  const haystack = normalize(
    `${paper.title} ${paper.summary} ${paper.category} ${paper.categories.join(" ")} ${paper.tags.join(" ")}`,
  );
  const matches = affinityTerms.filter((term) => includesTerm(haystack, term)).length;
  return clamp(0.18 + (matches / Math.min(4, affinityTerms.length)) * 0.82);
}

function freshnessScore(published: string, now: Date) {
  const publishedAt = new Date(published).getTime();
  if (!Number.isFinite(publishedAt)) return 0.45;
  const ageDays = Math.max(0, (now.getTime() - publishedAt) / 86_400_000);
  return clamp(0.2 + 0.8 * Math.exp(-ageDays / 38));
}

function evidenceScore(paper: CandidatePaper) {
  const haystack = normalize(`${paper.summary} ${paper.comment ?? ""}`);
  const groupsMatched = EVIDENCE_GROUPS.filter((group) =>
    group.some((signal) => includesTerm(haystack, signal)),
  ).length;
  const abstractDepth = clamp(paper.summary.split(/\s+/).filter(Boolean).length / 260);
  return clamp(0.24 + groupsMatched * 0.12 + abstractDepth * 0.14);
}

function influenceScore(
  paper: CandidatePaper,
  evidence: number,
  influence?: InfluenceSignal,
) {
  const citationCount = Math.max(0, influence?.citationCount ?? 0);
  const influentialCitationCount = Math.max(0, influence?.influentialCitationCount ?? 0);
  const citations = clamp(Math.log1p(citationCount) / Math.log(51));
  const influential = clamp(Math.log1p(influentialCitationCount) / Math.log(11));
  const categoryBreadth = clamp((paper.categories.length - 1) / 3);
  const collaborationBreadth = clamp((paper.authors.length - 1) / 9);
  return clamp(
    0.17
      + citations * 0.39
      + influential * 0.16
      + categoryBreadth * 0.1
      + collaborationBreadth * 0.06
      + evidence * 0.12,
  );
}

function scoreReason(
  matchedInterests: string[],
  affinity: number,
  freshness: number,
  evidence: number,
  citationCount: number,
) {
  const parts: string[] = [];
  if (matchedInterests.length) {
    parts.push(`匹配 ${matchedInterests.slice(0, 2).join(" + ")}`);
  }
  if (citationCount > 0) {
    parts.push(`${citationCount} 次引用信号`);
  } else if (affinity >= 0.58) {
    parts.push("来自你的阅读反馈");
  } else if (evidence >= 0.62) {
    parts.push("实验 / 开源信号较完整");
  } else if (freshness >= 0.8) {
    parts.push("近期新作");
  }
  return parts.slice(0, 2).join(" · ") || "近期高相关工作";
}

function paperTokens(paper: CandidatePaper) {
  const titleTokens = normalize(paper.title)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token));
  return new Set([
    ...titleTokens,
    ...paper.categories.map(normalize),
    ...paper.tags.map(normalize),
  ]);
}

function similarity(left: CandidatePaper, right: CandidatePaper) {
  const a = paperTokens(left);
  const b = paperTokens(right);
  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) intersection += 1;
  }
  const union = new Set([...a, ...b]).size;
  return union ? intersection / union : 0;
}

export function rankPapers(
  papers: CandidatePaper[],
  interests: string[],
  affinityTerms: string[],
  influenceById: Map<string, InfluenceSignal>,
  limit: number,
  options: { diversify?: boolean; now?: Date } = {},
) {
  const now = options.now ?? new Date();
  const ranked = papers.map((paper) => {
    const matches = interests
      .map((interest) => ({ interest, ...interestMatch(paper, interest) }))
      .sort((a, b) => b.strength - a.strength);
    const matchedInterests = matches.filter((match) => match.matched).map((match) => match.interest);
    const topMatch = matches[0]?.strength ?? 0;
    const coverage = matches.slice(0, 2).reduce((total, match) => total + match.strength, 0) / Math.max(1, Math.min(2, matches.length));
    const relevance = clamp(0.16 + topMatch * 0.66 + coverage * 0.18);
    const affinity = affinityScore(paper, affinityTerms);
    const freshness = freshnessScore(paper.published, now);
    const evidence = evidenceScore(paper);
    const influenceSignal = influenceById.get(paper.id);
    const influence = influenceScore(paper, evidence, influenceSignal);
    const composite =
      relevance * ORBIT_V2_WEIGHTS.relevance
      + affinity * ORBIT_V2_WEIGHTS.affinity
      + freshness * ORBIT_V2_WEIGHTS.freshness
      + influence * ORBIT_V2_WEIGHTS.influence
      + evidence * ORBIT_V2_WEIGHTS.evidence;
    const citationCount = influenceSignal?.citationCount ?? 0;
    const recommendation: RecommendationDetails = {
      reason: scoreReason(matchedInterests, affinity, freshness, evidence, citationCount),
      matchedInterests,
      signals: {
        relevance: Math.round(relevance * 100),
        affinity: Math.round(affinity * 100),
        freshness: Math.round(freshness * 100),
        influence: Math.round(influence * 100),
        evidence: Math.round(evidence * 100),
      },
      ...(citationCount > 0 ? { citationCount } : {}),
      ...((influenceSignal?.influentialCitationCount ?? 0) > 0
        ? { influentialCitationCount: influenceSignal?.influentialCitationCount }
        : {}),
    };
    return {
      ...paper,
      score: Math.round(clamp(50 + composite * 48, 50, 98)),
      recommendation,
      composite,
    };
  });

  ranked.sort((a, b) => b.composite - a.composite || a.id.localeCompare(b.id));
  if (options.diversify === false) {
    return ranked.slice(0, limit).map(({ composite, ...paper }) => {
      void composite;
      return paper;
    });
  }

  const relevant = ranked.filter(
    (paper) => paper.recommendation.matchedInterests.length > 0,
  );
  const candidatePool = relevant.length >= limit ? relevant : ranked;
  const baseRank = new Map(candidatePool.map((paper, index) => [paper.id, index]));
  const remaining = [...candidatePool];
  const selected: typeof ranked = [];
  const categoryCount = new Map<string, number>();

  while (remaining.length && selected.length < limit) {
    let bestIndex = 0;
    let bestAdjusted = Number.NEGATIVE_INFINITY;
    remaining.forEach((candidate, index) => {
      const overlap = selected.length
        ? Math.max(...selected.map((chosen) => similarity(candidate, chosen)))
        : 0;
      const repeatedCategory = categoryCount.get(candidate.category) ?? 0;
      const adjusted =
        candidate.composite
        - overlap * ORBIT_DIVERSITY_WEIGHTS.similarity
        - repeatedCategory * ORBIT_DIVERSITY_WEIGHTS.repeatedCategory;
      if (
        adjusted > bestAdjusted
        || (adjusted === bestAdjusted && candidate.id.localeCompare(remaining[bestIndex].id) < 0)
      ) {
        bestAdjusted = adjusted;
        bestIndex = index;
      }
    });
    const [chosen] = remaining.splice(bestIndex, 1);
    const exploration = (baseRank.get(chosen.id) ?? 0) >= limit;
    if (exploration) {
      chosen.recommendation = {
        ...chosen.recommendation,
        reason: `${chosen.recommendation.reason} · 主题探索`,
        exploration: true,
      };
    }
    selected.push(chosen);
    categoryCount.set(chosen.category, (categoryCount.get(chosen.category) ?? 0) + 1);
  }

  return selected.map(({ composite, ...paper }) => {
    void composite;
    return paper;
  });
}

export function canonicalPaperId(id: string) {
  return id
    .trim()
    .replace(/^https?:\/\/(?:export\.)?arxiv\.org\/(?:abs|pdf)\//i, "")
    .replace(/\.pdf$/i, "")
    .replace(/v\d+$/i, "")
    .toLowerCase();
}

export function dedupePapers<T extends CandidatePaper>(papers: T[]) {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const paper of papers) {
    const id = canonicalPaperId(paper.id);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    result.push(paper);
  }
  return result;
}

function profileAffinityScore(
  paper: CandidatePaper,
  profile: AffinityProfileV3,
  now: Date,
) {
  const haystack = normalize(
    `${paper.title} ${paper.summary} ${paper.category} ${paper.categories.join(" ")} ${paper.tags.join(" ")}`,
  );
  let total = 0;
  for (const [name, signal] of Object.entries(profile.signals)) {
    if (includesTerm(haystack, name)) {
      total += decayedAffinityValue(signal, now);
    }
  }
  return Math.tanh(total / 8);
}

function feedbackAdjustment(
  paper: CandidatePaper,
  feedback: PaperFeedback[],
  paperById: Map<string, CandidatePaper>,
  projectId: string,
) {
  const paperId = canonicalPaperId(paper.id);
  let exact = 0;
  let related = 0;
  let exactKind: FeedbackKind | null = null;
  for (const item of feedback) {
    if (item.projectId !== projectId) continue;
    const feedbackId = canonicalPaperId(item.paperId);
    const weights = LOCAL_FEEDBACK_WEIGHTS[item.kind];
    if (feedbackId === paperId) {
      exact += weights.exact;
      exactKind = item.kind;
      continue;
    }
    if (!weights.related) continue;
    const source = paperById.get(feedbackId);
    if (source) related += similarity(paper, source) * weights.related;
  }
  return {
    exact,
    related: clamp(related, -0.5, 0.32),
    exactKind,
  };
}

function localReason(
  baselineReason: string,
  profileAffinity: number,
  feedback: ReturnType<typeof feedbackAdjustment>,
) {
  if (feedback.exactKind === "relevant") {
    return `你标记为相关 · ${baselineReason}`;
  }
  if (feedback.exactKind === "not_relevant") {
    return `已按“不相关”反馈降权 · ${baselineReason}`;
  }
  if (feedback.exactKind === "too_broad") {
    return `已按“过于宽泛”反馈降权 · ${baselineReason}`;
  }
  if (feedback.exactKind === "already_knew") {
    return `已读过 / 已知 · ${baselineReason}`;
  }
  if (feedback.related >= 0.04) return `与你标记相关的论文相似 · ${baselineReason}`;
  if (profileAffinity >= 0.18) return `匹配本机阅读偏好 · ${baselineReason}`;
  return baselineReason;
}

export function rankPapersLocally(
  candidates: CandidatePaper[],
  seedPapers: CandidatePaper[],
  interests: string[],
  profile: AffinityProfileV3,
  feedback: PaperFeedback[],
  influenceById: Map<string, InfluenceSignal>,
  limit: number,
  options: { now?: Date; projectId?: string } = {},
): RecommendedPaper[] {
  const now = options.now ?? new Date();
  const projectId = options.projectId ?? DEFAULT_PROJECT_ID;
  const pool = dedupePapers([...candidates, ...seedPapers]);
  if (!pool.length || limit <= 0) return [];

  const baseline = rankPapers(
    pool,
    interests,
    [],
    influenceById,
    pool.length,
    { diversify: false, now },
  );
  const baselineRank = new Map(
    baseline.map((paper, index) => [canonicalPaperId(paper.id), index]),
  );
  const paperById = new Map(
    pool.map((paper) => [canonicalPaperId(paper.id), paper]),
  );

  const ranked = baseline.map((paper) => {
    const profileAffinity = profileAffinityScore(paper, profile, now);
    const feedbackEffect = feedbackAdjustment(
      paper,
      feedback,
      paperById,
      projectId,
    );
    const baseComposite = clamp((paper.score - 50) / 48);
    const localComposite =
      baseComposite
      + profileAffinity * 0.15
      + feedbackEffect.exact
      + feedbackEffect.related;
    const affinitySignal = clamp(
      0.5 + profileAffinity * 0.36 + feedbackEffect.related * 0.72,
    );
    return {
      ...paper,
      score: Math.round(clamp(50 + localComposite * 48, 0, 99)),
      recommendation: {
        ...paper.recommendation,
        reason: localReason(
          paper.recommendation.reason,
          profileAffinity,
          feedbackEffect,
        ),
        signals: {
          ...paper.recommendation.signals,
          affinity: Math.round(affinitySignal * 100),
        },
        exploration: false,
      },
      localComposite,
    };
  });

  ranked.sort(
    (left, right) =>
      right.localComposite - left.localComposite
      || canonicalPaperId(left.id).localeCompare(canonicalPaperId(right.id)),
  );

  const remaining = [...ranked];
  const selected: typeof ranked = [];
  const categoryCount = new Map<string, number>();
  while (remaining.length && selected.length < Math.min(limit, pool.length)) {
    let bestIndex = 0;
    let bestAdjusted = Number.NEGATIVE_INFINITY;
    remaining.forEach((candidate, index) => {
      const overlap = selected.length
        ? Math.max(...selected.map((chosen) => similarity(candidate, chosen)))
        : 0;
      const repeatedCategory = categoryCount.get(candidate.category) ?? 0;
      const adjusted =
        candidate.localComposite
        - overlap * ORBIT_DIVERSITY_WEIGHTS.similarity
        - repeatedCategory * ORBIT_DIVERSITY_WEIGHTS.repeatedCategory;
      if (
        adjusted > bestAdjusted
        || (
          adjusted === bestAdjusted
          && canonicalPaperId(candidate.id).localeCompare(
            canonicalPaperId(remaining[bestIndex].id),
          ) < 0
        )
      ) {
        bestAdjusted = adjusted;
        bestIndex = index;
      }
    });
    const [chosen] = remaining.splice(bestIndex, 1);
    const exploration =
      (baselineRank.get(canonicalPaperId(chosen.id)) ?? 0) >= limit;
    if (exploration) {
      chosen.recommendation = {
        ...chosen.recommendation,
        reason: `${chosen.recommendation.reason} · 多样性探索`,
        exploration: true,
      };
    }
    selected.push(chosen);
    categoryCount.set(
      chosen.category,
      (categoryCount.get(chosen.category) ?? 0) + 1,
    );
  }

  return selected.map(({ localComposite, ...paper }) => {
    void localComposite;
    return paper;
  });
}
