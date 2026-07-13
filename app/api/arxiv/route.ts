type ArxivPaper = {
  id: string;
  title: string;
  authors: string[];
  summary: string;
  published: string;
  category: string;
  categories: string[];
  score: number;
  minutes: number;
  url: string;
  pdfUrl: string;
  tags: string[];
};

const INTEREST_KEYWORDS: Record<string, string[]> = {
  "Physical AI": ["physical", "robot", "dynamics", "control", "action"],
  "Multimodal Reasoning": ["multimodal", "reasoning", "vision-language", "visual reasoning"],
  "Embodied Intelligence": ["embodied", "robot", "manipulation", "navigation", "agent"],
  "World Models": ["world model", "video", "simulation", "dynamics"],
  "AI for Science": ["science", "physics", "equation", "scientific"],
  "Vision-Language Models": ["vision-language", "vlm", "multimodal"],
  "Robot Learning": ["robot", "policy", "imitation", "reinforcement"],
  "Mechanistic Interpretability": ["mechanistic", "interpretability", "circuit", "representation"],
};

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
  return decodeXml(block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"))?.[1] ?? "");
}

function scorePaper(title: string, summary: string, interests: string[]) {
  const haystack = `${title} ${summary}`.toLowerCase();
  const keywords = interests.flatMap((interest) => INTEREST_KEYWORDS[interest] ?? [interest.toLowerCase()]);
  const matches = new Set(keywords.filter((keyword) => haystack.includes(keyword.toLowerCase()))).size;
  const titleBonus = keywords.some((keyword) => title.toLowerCase().includes(keyword.toLowerCase())) ? 5 : 0;
  return Math.min(98, 76 + matches * 3 + titleBonus);
}

function tagsFor(categories: string[], title: string) {
  const tags: string[] = [];
  if (categories.includes("cs.RO")) tags.push("Robot Learning");
  if (categories.includes("cs.CV")) tags.push("Computer Vision");
  if (categories.includes("cs.CL")) tags.push("Language Intelligence");
  if (categories.includes("cs.AI")) tags.push("Artificial Intelligence");
  if (/world model|video/i.test(title)) tags.push("World Models");
  if (/multimodal|vision-language/i.test(title)) tags.push("Multimodal");
  return Array.from(new Set(tags)).slice(0, 3);
}

function parseFeed(xml: string, interests: string[]): ArxivPaper[] {
  return xml
    .split(/<entry>/i)
    .slice(1)
    .map((entry) => {
      const rawId = tagValue(entry, "id");
      const id = rawId.split("/abs/").pop()?.replace(/v\d+$/, "") ?? rawId;
      const title = tagValue(entry, "title");
      const summary = tagValue(entry, "summary");
      const published = tagValue(entry, "published");
      const authors = Array.from(entry.matchAll(/<author>[\s\S]*?<name[^>]*>([\s\S]*?)<\/name>[\s\S]*?<\/author>/gi)).map((match) => decodeXml(match[1]));
      const categories = Array.from(entry.matchAll(/<category[^>]*term=["']([^"']+)["'][^>]*\/?\s*>/gi)).map((match) => match[1]);
      const wordCount = summary.split(/\s+/).filter(Boolean).length;
      return {
        id,
        title,
        authors,
        summary,
        published,
        category: categories[0] ?? "arXiv",
        categories,
        score: scorePaper(title, summary, interests),
        minutes: Math.max(10, Math.min(28, Math.round(wordCount / 18) + 9)),
        url: `https://arxiv.org/abs/${id}`,
        pdfUrl: `https://arxiv.org/pdf/${id}`,
        tags: tagsFor(categories, title),
      };
    })
    .filter((paper) => paper.id && paper.title);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("mode");
  const q = (url.searchParams.get("q") ?? "").replace(/[^\p{L}\p{N}\s._-]/gu, " ").trim().slice(0, 120);
  const interests = (url.searchParams.get("interests") ?? "Physical AI,Multimodal Reasoning,Embodied Intelligence")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, 8);

  if (mode !== "feed" && !q) {
    return Response.json({ error: "q is required" }, { status: 400 });
  }

  const searchQuery = mode === "feed"
    ? "(cat:cs.RO OR cat:cs.CV OR cat:cs.AI OR cat:cs.LG) AND (all:robot OR all:multimodal OR all:reasoning OR all:embodied OR all:physics OR all:video)"
    : `all:${q}`;
  const endpoint = new URL("https://export.arxiv.org/api/query");
  endpoint.searchParams.set("search_query", searchQuery);
  endpoint.searchParams.set("start", "0");
  endpoint.searchParams.set("max_results", mode === "feed" ? "12" : "8");
  endpoint.searchParams.set("sortBy", "submittedDate");
  endpoint.searchParams.set("sortOrder", "descending");

  try {
    const response = await fetch(endpoint, {
      headers: { "User-Agent": "PaperOrbit/1.0 (personal research reading app)" },
    });
    if (!response.ok) throw new Error(`arXiv returned ${response.status}`);
    const papers = parseFeed(await response.text(), interests)
      .sort((a, b) => b.score - a.score)
      .slice(0, mode === "feed" ? 5 : 8);
    return Response.json(
      { papers, source: "arxiv" },
      { headers: { "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=86400" } },
    );
  } catch {
    return Response.json({ error: "arXiv is temporarily unavailable" }, { status: 502 });
  }
}
