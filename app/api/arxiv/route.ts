import { paperOrbitApiAccessError } from "../../access-control";
import {
  buildGenericFeedQuery,
  canonicalPaperId,
  dedupePapers,
  rankPapers,
  SUPPORTED_RESEARCH_DIRECTIONS,
  type CandidatePaper,
  type InfluenceSignal,
  type RecommendedPaper,
} from "./recommendation";
import {
  buildArxivSearchQuery,
  parseArxivSearchParams,
} from "./search-query";
import { semanticScholarCredential } from "./research-session";

const PRIVATE_NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store",
  Pragma: "no-cache",
  Expires: "0",
};

function privateJson(
  body: unknown,
  init: Omit<ResponseInit, "headers"> & { headers?: HeadersInit } = {},
) {
  const headers = new Headers(init.headers);
  for (const [name, value] of Object.entries(PRIVATE_NO_STORE_HEADERS)) {
    headers.set(name, value);
  }
  return Response.json(body, { ...init, headers });
}

function withPrivateCache(response: Response) {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(PRIVATE_NO_STORE_HEADERS)) {
    headers.set(name, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function decodeXml(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function tagValue(block: string, tag: string) {
  return decodeXml(
    block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"))?.[1]
      ?? "",
  );
}

function integerTag(block: string, tag: string, fallback: number) {
  const value = Number.parseInt(tagValue(block, tag), 10);
  return Number.isFinite(value) ? value : fallback;
}

function tagsFor(categories: string[], title: string, summary: string) {
  const tags: string[] = [];
  const text = `${title} ${summary}`;
  if (categories.includes("cs.RO")) tags.push("Robot Learning");
  if (categories.includes("cs.CV")) tags.push("Computer Vision");
  if (categories.includes("cs.CL")) tags.push("Language Intelligence");
  if (categories.includes("cs.AI")) tags.push("Artificial Intelligence");
  if (categories.some((category) => category.startsWith("physics"))) {
    tags.push("AI for Science");
  }
  if (/world model|video prediction|video generation/i.test(text)) {
    tags.push("World Models");
  }
  if (/multimodal|vision-language|\bvlm\b|\bmllm\b/i.test(text)) {
    tags.push("Multimodal");
  }
  if (/robot|manipulation|locomotion|policy learning/i.test(text)) {
    tags.push("Embodied AI");
  }
  if (/interpretability|model circuit|activation patching/i.test(text)) {
    tags.push("Interpretability");
  }
  return Array.from(new Set(tags)).slice(0, 4);
}

function parseFeed(xml: string, requestedStart: number, requestedLimit: number) {
  const papers = xml
    .split(/<entry>/i)
    .slice(1)
    .map((entry): CandidatePaper => {
      const rawId = tagValue(entry, "id");
      const id = rawId.split("/abs/").pop()?.replace(/v\d+$/, "") ?? rawId;
      const title = tagValue(entry, "title");
      const summary = tagValue(entry, "summary");
      const published = tagValue(entry, "published");
      const authors = Array.from(
        entry.matchAll(
          /<author>[\s\S]*?<name[^>]*>([\s\S]*?)<\/name>[\s\S]*?<\/author>/gi,
        ),
      ).map((match) => decodeXml(match[1]));
      const categories = Array.from(
        entry.matchAll(/<category[^>]*term=["']([^"']+)["'][^>]*\/?\s*>/gi),
      ).map((match) => match[1]);
      const wordCount = summary.split(/\s+/).filter(Boolean).length;
      return {
        id,
        title,
        authors,
        summary,
        published,
        updated: tagValue(entry, "updated"),
        comment: tagValue(entry, "arxiv:comment"),
        category: categories[0] ?? "arXiv",
        categories,
        minutes: Math.max(10, Math.min(28, Math.round(wordCount / 18) + 9)),
        url: `https://arxiv.org/abs/${id}`,
        pdfUrl: `https://arxiv.org/pdf/${id}`,
        tags: tagsFor(categories, title, summary),
      };
    })
    .filter((paper) => paper.id && paper.title);

  return {
    papers: dedupePapers(papers),
    totalResults: integerTag(xml, "opensearch:totalResults", papers.length),
    startIndex: integerTag(xml, "opensearch:startIndex", requestedStart),
    itemsPerPage: integerTag(xml, "opensearch:itemsPerPage", requestedLimit),
  };
}

async function getInfluenceSignals(
  papers: CandidatePaper[],
  apiKey?: string,
) {
  const signals = new Map<string, InfluenceSignal>();
  if (!papers.length) return signals;

  const endpoint = new URL("https://api.semanticscholar.org/graph/v1/paper/batch");
  endpoint.searchParams.set(
    "fields",
    "externalIds,citationCount,influentialCitationCount",
  );
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3_500);

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": "PaperOrbit/3.0 (personal research reading app)",
    };
    if (apiKey) headers["x-api-key"] = apiKey;
    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({ ids: papers.map((paper) => `ARXIV:${paper.id}`) }),
      signal: controller.signal,
    });
    if (!response.ok) return signals;
    const data = (await response.json()) as Array<{
      externalIds?: { ArXiv?: string };
      citationCount?: number;
      influentialCitationCount?: number;
    } | null>;
    for (const item of data) {
      const id = item?.externalIds?.ArXiv?.replace(/v\d+$/, "");
      if (!id) continue;
      signals.set(canonicalPaperId(id), {
        citationCount: Math.max(0, item?.citationCount ?? 0),
        influentialCitationCount: Math.max(
          0,
          item?.influentialCitationCount ?? 0,
        ),
      });
    }
  } catch {
    // Citation data enhances public candidates; arXiv remains the safe fallback.
  } finally {
    clearTimeout(timeout);
  }
  return signals;
}

function influenceForRanking(
  papers: CandidatePaper[],
  canonicalSignals: Map<string, InfluenceSignal>,
) {
  return new Map(
    papers.flatMap((paper) => {
      const signal = canonicalSignals.get(canonicalPaperId(paper.id));
      return signal ? [[paper.id, signal] as const] : [];
    }),
  );
}

function scoreWithoutReordering(
  papers: CandidatePaper[],
  interests: string[],
  influence: Map<string, InfluenceSignal>,
) {
  const scored = rankPapers(
    papers,
    interests,
    [],
    influence,
    papers.length,
    { diversify: false },
  );
  const byId = new Map(
    scored.map((paper) => [canonicalPaperId(paper.id), paper]),
  );
  return papers.flatMap((paper) => {
    const result = byId.get(canonicalPaperId(paper.id));
    return result ? [result] : [];
  });
}

async function arxivRequest(endpoint: URL) {
  const response = await fetch(endpoint, {
    headers: { "User-Agent": "PaperOrbit/3.0 (personal research reading app)" },
  });
  if (!response.ok) throw new Error(`arXiv returned ${response.status}`);
  return response.text();
}

export async function GET(request: Request) {
  const accessError = await paperOrbitApiAccessError();
  if (accessError) return withPrivateCache(accessError);

  const url = new URL(request.url);
  const feedMode = url.searchParams.get("mode") === "feed";

  try {
    if (feedMode) {
      const endpoint = new URL("https://export.arxiv.org/api/query");
      endpoint.searchParams.set("search_query", buildGenericFeedQuery());
      endpoint.searchParams.set("start", "0");
      endpoint.searchParams.set("max_results", "60");
      endpoint.searchParams.set("sortBy", "submittedDate");
      endpoint.searchParams.set("sortOrder", "descending");

      const parsed = parseFeed(await arxivRequest(endpoint), 0, 60);
      const metadataCredential = await semanticScholarCredential(request);
      const canonicalInfluence = await getInfluenceSignals(
        parsed.papers,
        metadataCredential?.apiKey,
      );
      const influence = influenceForRanking(parsed.papers, canonicalInfluence);
      const papers: RecommendedPaper[] = scoreWithoutReordering(
        parsed.papers,
        [...SUPPORTED_RESEARCH_DIRECTIONS],
        influence,
      );

      return privateJson({
        papers,
        source: canonicalInfluence.size
          ? "arxiv+semantic-scholar"
          : "arxiv",
        meta: {
          mode: "feed",
          rankingVersion: "orbit-v3-local",
          candidateCount: papers.length,
          dailyLimit: 10,
          metadataCredential: metadataCredential?.source ?? "public",
          personalization: "client",
          signals: [
            "interest",
            "local-affinity",
            "explicit-feedback",
            "freshness",
            "influence",
            "evidence",
            "diversity",
          ],
        },
      });
    }

    const search = parseArxivSearchParams(url.searchParams);
    if (!search.q) {
      return privateJson({ error: "q is required" }, { status: 400 });
    }
    const upstream = buildArxivSearchQuery(search);
    const endpoint = new URL("https://export.arxiv.org/api/query");
    if (upstream.idList) endpoint.searchParams.set("id_list", upstream.idList);
    else endpoint.searchParams.set("search_query", upstream.searchQuery ?? "");
    endpoint.searchParams.set("start", String(upstream.start));
    endpoint.searchParams.set("max_results", String(upstream.limit));
    endpoint.searchParams.set("sortBy", upstream.sortBy);
    endpoint.searchParams.set("sortOrder", upstream.sortOrder);

    const parsed = parseFeed(
      await arxivRequest(endpoint),
      upstream.start,
      upstream.limit,
    );
    const papers = scoreWithoutReordering(
      parsed.papers,
      [search.q],
      new Map(),
    );
    const start = Math.max(0, parsed.startIndex);
    const totalResults = Math.max(
      start + papers.length,
      parsed.totalResults,
    );
    return privateJson({
      papers,
      source: "arxiv",
      meta: {
        mode: "search",
        totalResults,
        start,
        limit: search.limit,
        itemsPerPage: parsed.itemsPerPage,
        hasPrevious: start > 0,
        hasNext: start + papers.length < totalResults,
        sort: search.sort,
        order: search.order,
        field: search.field,
        match: search.match,
      },
    });
  } catch {
    return privateJson(
      { error: "arXiv is temporarily unavailable" },
      { status: 502 },
    );
  }
}
