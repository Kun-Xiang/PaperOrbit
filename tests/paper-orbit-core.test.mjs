import assert from "node:assert/strict";
import test from "node:test";

import {
  buildArxivSearchQuery,
  normalizeArxivId,
  parseArxivSearchParams,
} from "../app/api/arxiv/search-query.ts";
import {
  adjustAffinityProfile,
  buildGenericFeedQuery,
  decayedAffinityValue,
  dedupePapers,
  loadAffinityProfile,
  parseFeedbackStorage,
  rankPapers,
  rankPapersLocally,
  upsertPaperFeedback,
} from "../app/api/arxiv/recommendation.ts";
import {
  claimLegacyStorage,
  LEGACY_STORAGE,
  LEGACY_STORAGE_CLAIM_KEY,
  storageKeysFor,
} from "../app/local-user-storage.ts";

function params(query) {
  return parseArxivSearchParams(new URLSearchParams(query), 2027);
}

function paper(index, overrides = {}) {
  const id = `2607.${String(index + 1).padStart(5, "0")}`;
  return {
    id,
    title: `Robot multimodal reasoning study ${index}`,
    authors: [`Researcher ${index}`],
    summary:
      "We study robot learning with multimodal reasoning, extensive experiments, ablation benchmarks, and real-world evaluation.",
    published: `2026-07-${String((index % 9) + 1).padStart(2, "0")}`,
    updated: `2026-07-${String((index % 9) + 1).padStart(2, "0")}`,
    comment: "Code is open source.",
    category: index % 2 ? "cs.CV" : "cs.RO",
    categories: [index % 2 ? "cs.CV" : "cs.RO"],
    minutes: 15,
    url: `https://arxiv.org/abs/${id}`,
    pdfUrl: `https://arxiv.org/pdf/${id}`,
    tags: index % 2 ? ["Multimodal"] : ["Robot Learning"],
    ...overrides,
  };
}

const now = new Date("2026-07-16T00:00:00.000Z");

function assertEnglishRecommendationReason(reason, expected) {
  assert.equal(
    /[\u3400-\u9fff]/u.test(reason),
    false,
    `recommendation reason should not contain Han characters: ${reason}`,
  );
  assert.match(reason, expected);
}

function memoryStorage(entries = {}) {
  const values = new Map(Object.entries(entries));
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
  };
}

test("local browser data is namespaced by normalized ChatGPT email", () => {
  const alice = storageKeysFor(" Alice@Example.com ");
  const bob = storageKeysFor("bob@example.com");
  assert.equal(alice.saved, "paper-orbit:user:alice%40example.com:saved");
  assert.notEqual(alice.saved, bob.saved);
  assert.notEqual(alice.affinity, bob.affinity);
  assert.match(alice.feedback, /paper-feedback-v1$/);
});

test("legacy local data can be claimed once by a privileged account", () => {
  const local = memoryStorage({
    [LEGACY_STORAGE.saved]: JSON.stringify(["2607.00001"]),
    [LEGACY_STORAGE.interests]: JSON.stringify(["Robot Learning"]),
  });
  const reader = storageKeysFor("reader@example.com");
  const owner = storageKeysFor("xiangk123@gmail.com");
  const manager = storageKeysFor("xumiaojun49@gmail.com");

  assert.equal(
    claimLegacyStorage(local, reader, "reader@example.com", false),
    false,
  );
  assert.equal(local.getItem(reader.saved), null);
  assert.equal(local.getItem(LEGACY_STORAGE_CLAIM_KEY), null);

  assert.equal(
    claimLegacyStorage(local, owner, "XIANGK123@GMAIL.COM", true),
    true,
  );
  assert.equal(
    local.getItem(owner.saved),
    JSON.stringify(["2607.00001"]),
  );
  assert.equal(
    local.getItem(LEGACY_STORAGE_CLAIM_KEY),
    "xiangk123@gmail.com",
  );

  assert.equal(
    claimLegacyStorage(local, manager, "xumiaojun49@gmail.com", true),
    false,
  );
  assert.equal(local.getItem(manager.saved), null);
});

test("search defaults to relevance with safe pagination defaults", () => {
  const parsed = params("q=robot+learning");
  assert.equal(parsed.field, "all");
  assert.equal(parsed.match, "all");
  assert.equal(parsed.sort, "relevance");
  assert.equal(parsed.order, "descending");
  assert.equal(parsed.start, 0);
  assert.equal(parsed.limit, 20);
});

test("invalid enum values fall back and numeric values stay in bounds", () => {
  const parsed = params(
    "q=test&field=unsafe&match=raw&sort=random&order=sideways&start=-8&limit=500",
  );
  assert.equal(parsed.field, "all");
  assert.equal(parsed.match, "all");
  assert.equal(parsed.sort, "relevance");
  assert.equal(parsed.order, "descending");
  assert.equal(parsed.start, 0);
  assert.equal(parsed.limit, 50);
  assert.equal(params("q=test&limit=0").limit, 1);
});

test("title phrase search becomes one safely quoted title expression", () => {
  const query = buildArxivSearchQuery(
    params("q=world+models&field=title&match=phrase"),
  );
  assert.equal(query.searchQuery, '(ti:"world models")');
});

test("author search uses the author field and AND semantics", () => {
  const query = buildArxivSearchQuery(
    params("q=Fei-Fei+Li&field=author&match=all"),
  );
  assert.equal(query.searchQuery, '(au:"Fei-Fei" AND au:"Li")');
});

test("any-match search joins safe terms with OR", () => {
  const query = buildArxivSearchQuery(
    params("q=robot+vision&field=abstract&match=any"),
  );
  assert.equal(query.searchQuery, '(abs:"robot" OR abs:"vision")');
});

test("exclusions use ANDNOT without accepting raw arXiv syntax", () => {
  const query = buildArxivSearchQuery(
    params("q=robot&exclude=survey+review%3Aall"),
  );
  assert.equal(
    query.searchQuery,
    '(all:"robot") ANDNOT (all:"survey" OR all:"review" OR all:"all")',
  );
});

test("category and publication year constraints are applied server-side", () => {
  const query = buildArxivSearchQuery(
    params("q=control&category=cs.RO&fromYear=2025&toYear=2026"),
  );
  assert.match(query.searchQuery, /AND cat:cs\.RO/);
  assert.match(
    query.searchQuery,
    /submittedDate:\[202501010000 TO 202612312359\]/,
  );
});

test("reversed valid year bounds are normalized", () => {
  const parsed = params("q=control&fromYear=2026&toYear=2024");
  assert.equal(parsed.fromYear, 2024);
  assert.equal(parsed.toYear, 2026);
});

test("a direct arXiv identifier stays on the id_list path", () => {
  const query = buildArxivSearchQuery(params("q=arXiv%3A2607.12345v2"));
  assert.equal(query.idList, "2607.12345");
  assert.equal(query.searchQuery, undefined);
  assert.equal(
    normalizeArxivId("https://arxiv.org/pdf/2607.12345v4.pdf"),
    "2607.12345",
  );
  assert.equal(normalizeArxivId("2607.12345v4"), "2607.12345");
});

test("generic feed query is fixed across all supported research directions", () => {
  const query = buildGenericFeedQuery();
  assert.match(query, /cat:cs\.RO/);
  assert.match(query, /cat:cs\.CV/);
  assert.match(query, /all:robot/);
  assert.match(query, /all:scientific/);
  assert.match(query, /all:interpretability/);
  assert.match(query, / OR /);
});

test("v2 affinity migrates to timestamped v3 signals", () => {
  const loaded = loadAffinityProfile(
    null,
    JSON.stringify({ "Robot Learning": 3.5, invalid: "bad" }),
    now,
  );
  assert.equal(loaded.migrated, true);
  assert.equal(loaded.profile.version, 3);
  assert.deepEqual(loaded.profile.signals["Robot Learning"], {
    value: 3.5,
    updatedAt: now.toISOString(),
  });
  assert.equal(loaded.profile.signals.invalid, undefined);
});

test("an existing v3 profile wins over legacy v2 data", () => {
  const loaded = loadAffinityProfile(
    JSON.stringify({
      version: 3,
      signals: { "cs.RO": { value: 2, updatedAt: now.toISOString() } },
    }),
    JSON.stringify({ "cs.CV": 9 }),
    now,
  );
  assert.equal(loaded.migrated, false);
  assert.equal(loaded.profile.signals["cs.RO"].value, 2);
  assert.equal(loaded.profile.signals["cs.CV"], undefined);
});

test("corrupt local affinity and feedback JSON fall back safely", () => {
  assert.deepEqual(loadAffinityProfile("{broken", null, now).profile, {
    version: 3,
    signals: {},
  });
  assert.deepEqual(parseFeedbackStorage("not-json"), []);
  assert.deepEqual(parseFeedbackStorage('{"kind":"relevant"}'), []);
});

test("affinity decay has an injectable 90-day half-life", () => {
  const value = decayedAffinityValue(
    { value: 8, updatedAt: "2026-01-01T00:00:00.000Z" },
    new Date("2026-04-01T00:00:00.000Z"),
  );
  assert.equal(value, 4);
});

test("behavior updates preserve v3 and retract signals without going below bounds", () => {
  const first = adjustAffinityProfile(
    { version: 3, signals: {} },
    paper(0),
    1.5,
    now,
  );
  assert.equal(first.signals["cs.RO"].value, 1.5);
  const retracted = adjustAffinityProfile(first, paper(0), -0.6, now);
  assert.equal(retracted.signals["cs.RO"].value, 0.9);
  assert.equal(retracted.version, 3);
});

test("feedback can be set, changed, and undone independently of paper visibility", () => {
  let feedback = upsertPaperFeedback([], "2607.99999", "relevant", now);
  assert.equal(feedback[0].kind, "relevant");
  feedback = upsertPaperFeedback(
    feedback,
    "2607.99999",
    "not_relevant",
    new Date("2026-07-17T00:00:00.000Z"),
  );
  assert.equal(feedback.length, 1);
  assert.equal(feedback[0].kind, "not_relevant");
  feedback = upsertPaperFeedback(feedback, "2607.99999", null, now);
  assert.deepEqual(feedback, []);
});

test("paper deduplication canonicalizes arXiv versions", () => {
  const original = paper(0);
  const duplicate = { ...original, id: `${original.id}v3` };
  assert.equal(dedupePapers([original, duplicate]).length, 1);
});

test("local ranking returns exactly ten deduplicated papers with seed fill", () => {
  const candidates = [paper(0), paper(1), { ...paper(1), id: "2607.00002v2" }];
  const seeds = Array.from({ length: 10 }, (_, index) => paper(index + 20));
  const ranked = rankPapersLocally(
    candidates,
    seeds,
    ["Robot Learning", "Multimodal Reasoning"],
    { version: 3, signals: {} },
    [],
    new Map(),
    10,
    { now },
  );
  assert.equal(ranked.length, 10);
  assert.equal(new Set(ranked.map((item) => item.id.replace(/v\d+$/, ""))).size, 10);
});

test("local ranking is deterministic and never uses randomness", () => {
  const candidates = Array.from({ length: 12 }, (_, index) => paper(index));
  const args = [
    candidates,
    [],
    ["Robot Learning", "Multimodal Reasoning"],
    { version: 3, signals: {} },
    [],
    new Map(),
    10,
    { now },
  ];
  const left = rankPapersLocally(...args);
  const right = rankPapersLocally(...args);
  assert.deepEqual(left, right);
});

test("default recommendation reasons use English copy without Han characters", () => {
  const [ranked] = rankPapersLocally(
    [paper(0)],
    [],
    ["Robot Learning"],
    { version: 3, signals: {} },
    [],
    new Map(),
    1,
    { now },
  );

  assertEnglishRecommendationReason(
    ranked.recommendation.reason,
    /^Matches Robot Learning(?: · |$)/,
  );
});

test("exact feedback recommendation reasons use English labels without Han characters", () => {
  const target = paper(0);
  const cases = [
    ["relevant", /^Marked relevant · /],
    ["not_relevant", /^Downranked by “Not relevant” feedback · /],
    ["too_broad", /^Downranked by “Too broad” feedback · /],
    ["already_knew", /^Already read \/ known · /],
  ];

  for (const [kind, expected] of cases) {
    const [ranked] = rankPapersLocally(
      [target],
      [],
      ["Robot Learning"],
      { version: 3, signals: {} },
      upsertPaperFeedback([], target.id, kind, now),
      new Map(),
      1,
      { now },
    );
    assertEnglishRecommendationReason(ranked.recommendation.reason, expected);
  }
});

test("server and local exploration reasons use English copy without Han characters", () => {
  const published = "2026-07-15T00:00:00.000Z";
  const similarPaper = (index) => paper(index, {
    title: "Robot Learning Architecture",
    published,
    updated: published,
    category: "cs.RO",
    categories: ["cs.RO"],
    tags: ["Robot Learning"],
  });
  const diversePaper = paper(42, {
    title: "Distinct Control Policy",
    published,
    updated: published,
    category: "cs.AI",
    categories: ["cs.AI"],
    tags: ["Policy Optimization"],
  });
  const candidates = [similarPaper(40), similarPaper(41), diversePaper];

  const serverRanking = rankPapers(
    candidates,
    ["Robot Learning"],
    [],
    new Map(),
    2,
    { now },
  );
  for (const item of serverRanking) {
    assert.equal(/[\u3400-\u9fff]/u.test(item.recommendation.reason), false);
  }
  const topicExploration = serverRanking.find(
    (item) => item.recommendation.exploration,
  );
  assert.ok(topicExploration, "expected the diversified server ranking to explore a topic");
  assertEnglishRecommendationReason(
    topicExploration.recommendation.reason,
    / · Topic exploration$/,
  );

  const localRanking = rankPapersLocally(
    candidates,
    [],
    ["Robot Learning"],
    { version: 3, signals: {} },
    [],
    new Map(),
    2,
    { now },
  );
  for (const item of localRanking) {
    assert.equal(/[\u3400-\u9fff]/u.test(item.recommendation.reason), false);
  }
  const diversityExploration = localRanking.find(
    (item) => item.recommendation.exploration,
  );
  assert.ok(diversityExploration, "expected the local ranking to explore for diversity");
  assertEnglishRecommendationReason(
    diversityExploration.recommendation.reason,
    / · Diversity exploration$/,
  );
});

test("relevant feedback raises a paper while negative kinds apply distinct penalties", () => {
  const candidates = Array.from({ length: 12 }, (_, index) => paper(index));
  const rankWith = (kind) =>
    rankPapersLocally(
      candidates,
      [],
      ["Robot Learning"],
      { version: 3, signals: {} },
      kind ? upsertPaperFeedback([], candidates[0].id, kind, now) : [],
      new Map(),
      candidates.length,
      { now },
    ).find((item) => item.id === candidates[0].id).score;
  const baseline = rankWith(null);
  assert.ok(rankWith("relevant") > baseline);
  assert.ok(rankWith("too_broad") < baseline);
  assert.ok(rankWith("not_relevant") < rankWith("too_broad"));
  assert.ok(rankWith("already_knew") < baseline);
});

test("already-knew feedback suppresses only the exact paper, not its topic neighbor", () => {
  const candidates = Array.from({ length: 12 }, (_, index) => paper(index));
  const baseline = rankPapersLocally(
    candidates,
    [],
    ["Robot Learning"],
    { version: 3, signals: {} },
    [],
    new Map(),
    candidates.length,
    { now },
  );
  const known = rankPapersLocally(
    candidates,
    [],
    ["Robot Learning"],
    { version: 3, signals: {} },
    upsertPaperFeedback([], candidates[0].id, "already_knew", now),
    new Map(),
    candidates.length,
    { now },
  );
  const score = (items, id) => items.find((item) => item.id === id).score;
  assert.ok(score(known, candidates[0].id) < score(baseline, candidates[0].id));
  assert.equal(score(known, candidates[1].id), score(baseline, candidates[1].id));
});

test("a paper marked not relevant cannot remain near the top of the daily order", () => {
  const target = paper(0, {
    title: "Robot Learning with Multimodal Reasoning",
    published: "2026-07-16T00:00:00.000Z",
  });
  const candidates = [
    target,
    ...Array.from({ length: 11 }, (_, index) => paper(index + 1)),
  ];
  const ranking = rankPapersLocally(
    candidates,
    [],
    ["Robot Learning", "Multimodal Reasoning"],
    { version: 3, signals: {} },
    upsertPaperFeedback([], target.id, "not_relevant", now),
    new Map(),
    candidates.length,
    { now },
  );
  assert.ok(ranking.findIndex((item) => item.id === target.id) >= 9);
});
