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
      relevance * 0.42
      + affinity * 0.12
      + freshness * 0.16
      + influence * 0.17
      + evidence * 0.13;
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
    return ranked.slice(0, limit).map(({ composite: _composite, ...paper }) => paper);
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
      const adjusted = candidate.composite - overlap * 0.16 - repeatedCategory * 0.025;
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

  return selected.map(({ composite: _composite, ...paper }) => paper);
}
