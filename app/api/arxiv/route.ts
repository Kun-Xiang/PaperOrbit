import {
  buildFeedQuery,
  rankPapers,
  type CandidatePaper,
  type InfluenceSignal,
} from "./recommendation";

const DEFAULT_INTERESTS = [
  "Physical AI",
  "Multimodal Reasoning",
  "Embodied Intelligence",
];

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
    block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"))?.[1] ?? "",
  );
}

function tagsFor(categories: string[], title: string, summary: string) {
  const tags: string[] = [];
  const text = `${title} ${summary}`;
  if (categories.includes("cs.RO")) tags.push("Robot Learning");
  if (categories.includes("cs.CV")) tags.push("Computer Vision");
  if (categories.includes("cs.CL")) tags.push("Language Intelligence");
  if (categories.includes("cs.AI")) tags.push("Artificial Intelligence");
  if (categories.some((category) => category.startsWith("physics"))) tags.push("AI for Science");
  if (/world model|video prediction|video generation/i.test(text)) tags.push("World Models");
  if (/multimodal|vision-language|\bvlm\b|\bmllm\b/i.test(text)) tags.push("Multimodal");
  if (/robot|manipulation|locomotion|policy learning/i.test(text)) tags.push("Embodied AI");
  if (/interpretability|model circuit|activation patching/i.test(text)) tags.push("Interpretability");
  return Array.from(new Set(tags)).slice(0, 4);
}

function parseFeed(xml: string): CandidatePaper[] {
  return xml
    .split(/<entry>/i)
    .slice(1)
    .map((entry) => {
      const rawId = tagValue(entry, "id");
      const id = rawId.split("/abs/").pop()?.replace(/v\d+$/, "") ?? rawId;
      const title = tagValue(entry, "title");
      const summary = tagValue(entry, "summary");
      const published = tagValue(entry, "published");
      const authors = Array.from(
        entry.matchAll(/<author>[\s\S]*?<name[^>]*>([\s\S]*?)<\/name>[\s\S]*?<\/author>/gi),
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
}

function parseList(value: string | null, separator: string, fallback: string[] = []) {
  const values = (value ?? "")
    .split(separator)
    .map((item) => item.trim())
    .filter(Boolean);
  return values.length ? Array.from(new Set(values)).slice(0, 12) : fallback;
}

async function getInfluenceSignals(papers: CandidatePaper[]) {
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
      "User-Agent": "PaperOrbit/2.0 (personal research reading app)",
    };
    if (process.env.SEMANTIC_SCHOLAR_API_KEY) {
      headers["x-api-key"] = process.env.SEMANTIC_SCHOLAR_API_KEY;
    }
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
      signals.set(id, {
        citationCount: Math.max(0, item?.citationCount ?? 0),
        influentialCitationCount: Math.max(0, item?.influentialCitationCount ?? 0),
      });
    }
  } catch {
    // Citation data is a ranking enhancement; arXiv-native signals remain available.
  } finally {
    clearTimeout(timeout);
  }
  return signals;
}

function searchExpression(query: string) {
  return query
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 8)
    .map((term) => `all:${term}`)
    .join(" AND ");
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("mode");
  const q = (url.searchParams.get("q") ?? "")
    .replace(/[^\p{L}\p{N}\s._-]/gu, " ")
    .trim()
    .slice(0, 120);
  const interests = parseList(
    url.searchParams.get("interests"),
    ",",
    DEFAULT_INTERESTS,
  ).slice(0, 8);
  const affinityTerms = parseList(url.searchParams.get("profile"), "|").slice(0, 10);

  if (mode !== "feed" && !q) {
    return Response.json({ error: "q is required" }, { status: 400 });
  }

  const endpoint = new URL("https://export.arxiv.org/api/query");
  const isArxivId = /^\d{4}\.\d{4,5}(v\d+)?$/i.test(q);
  if (mode === "feed") {
    endpoint.searchParams.set("search_query", buildFeedQuery(interests));
  } else if (isArxivId) {
    endpoint.searchParams.set("id_list", q);
  } else {
    endpoint.searchParams.set("search_query", searchExpression(q));
  }
  endpoint.searchParams.set("start", "0");
  endpoint.searchParams.set("max_results", mode === "feed" ? "60" : "12");
  endpoint.searchParams.set("sortBy", "submittedDate");
  endpoint.searchParams.set("sortOrder", "descending");

  try {
    const response = await fetch(endpoint, {
      headers: { "User-Agent": "PaperOrbit/2.0 (personal research reading app)" },
    });
    if (!response.ok) throw new Error(`arXiv returned ${response.status}`);
    const candidates = parseFeed(await response.text());
    const influence = mode === "feed"
      ? await getInfluenceSignals(candidates)
      : new Map<string, InfluenceSignal>();
    const papers = rankPapers(
      candidates,
      mode === "feed" ? interests : [q],
      mode === "feed" ? affinityTerms : [],
      influence,
      mode === "feed" ? 10 : 10,
      { diversify: mode === "feed" },
    );
    return Response.json(
      {
        papers,
        source: influence.size ? "arxiv+semantic-scholar" : "arxiv",
        meta: mode === "feed"
          ? {
              rankingVersion: "orbit-v2",
              candidateCount: candidates.length,
              dailyLimit: 10,
              signals: ["interest", "reading-affinity", "freshness", "influence", "evidence", "diversity"],
            }
          : undefined,
      },
      {
        headers: {
          "Cache-Control": mode === "feed"
            ? "public, s-maxage=10800, stale-while-revalidate=86400"
            : "public, s-maxage=1800, stale-while-revalidate=86400",
        },
      },
    );
  } catch {
    return Response.json(
      { error: "arXiv is temporarily unavailable" },
      { status: 502 },
    );
  }
}
