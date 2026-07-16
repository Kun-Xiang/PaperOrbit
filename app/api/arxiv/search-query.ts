export type ArxivSearchField = "all" | "title" | "author" | "abstract";
export type ArxivSearchMatch = "all" | "any" | "phrase";
export type ArxivSearchSort =
  | "relevance"
  | "submittedDate"
  | "lastUpdatedDate";
export type ArxivSearchOrder = "ascending" | "descending";

export type ArxivSearchParams = {
  q: string;
  field: ArxivSearchField;
  match: ArxivSearchMatch;
  exclude: string;
  category: string;
  fromYear?: number;
  toYear?: number;
  sort: ArxivSearchSort;
  order: ArxivSearchOrder;
  start: number;
  limit: number;
};

export type ArxivUpstreamQuery = {
  idList?: string;
  searchQuery?: string;
  sortBy: ArxivSearchSort;
  sortOrder: ArxivSearchOrder;
  start: number;
  limit: number;
};

const FIELD_PREFIX: Record<ArxivSearchField, string> = {
  all: "all",
  title: "ti",
  author: "au",
  abstract: "abs",
};

const SEARCH_FIELDS = new Set<ArxivSearchField>([
  "all",
  "title",
  "author",
  "abstract",
]);
const SEARCH_MATCHES = new Set<ArxivSearchMatch>(["all", "any", "phrase"]);
const SEARCH_SORTS = new Set<ArxivSearchSort>([
  "relevance",
  "submittedDate",
  "lastUpdatedDate",
]);
const SEARCH_ORDERS = new Set<ArxivSearchOrder>([
  "ascending",
  "descending",
]);

function enumValue<T extends string>(
  value: string | null,
  allowed: Set<T>,
  fallback: T,
) {
  return value && allowed.has(value as T) ? (value as T) : fallback;
}

function safeText(value: string | null, maxLength = 240) {
  return (value ?? "")
    .normalize("NFKC")
    .replace(/["“”‘’`(){}\[\]\\:]/g, " ")
    .replace(/[^\p{L}\p{N}\s._'/-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength)
    .trim();
}

function boundedInteger(
  value: string | null,
  fallback: number,
  min: number,
  max: number,
) {
  if (value === null || !/^-?\d+$/.test(value.trim())) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function optionalYear(value: string | null, latestYear: number) {
  if (value === null || !/^\d{4}$/.test(value.trim())) return undefined;
  const parsed = Number.parseInt(value, 10);
  return parsed >= 1991 && parsed <= latestYear ? parsed : undefined;
}

function safeCategory(value: string | null) {
  const category = (value ?? "").trim().slice(0, 40);
  return /^[a-z-]+(?:\.[a-z-]+)?$/i.test(category) ? category : "";
}

export function normalizeArxivId(value: string) {
  const id = value
    .trim()
    .replace(/^https?:\/\/(?:export\.)?arxiv\.org\/(?:abs|pdf)\//i, "")
    .replace(/\.pdf$/i, "")
    .replace(/^arxiv:/i, "")
    .replace(/v\d+$/i, "");
  return /^(?:\d{4}\.\d{4,5}|[a-z-]+(?:\.[A-Z]{2})?\/\d{7})$/i.test(id)
    ? id
    : "";
}

export function isDirectArxivId(value: string) {
  return Boolean(normalizeArxivId(value));
}

export function parseArxivSearchParams(
  searchParams: URLSearchParams,
  latestYear = new Date().getUTCFullYear() + 1,
): ArxivSearchParams {
  const rawQuery = searchParams.get("q") ?? "";
  const directId = normalizeArxivId(rawQuery);
  let fromYear = optionalYear(searchParams.get("fromYear"), latestYear);
  let toYear = optionalYear(searchParams.get("toYear"), latestYear);
  if (fromYear && toYear && fromYear > toYear) {
    [fromYear, toYear] = [toYear, fromYear];
  }

  return {
    q: directId || safeText(rawQuery, 200),
    field: enumValue(searchParams.get("field"), SEARCH_FIELDS, "all"),
    match: enumValue(searchParams.get("match"), SEARCH_MATCHES, "all"),
    exclude: safeText(searchParams.get("exclude"), 160),
    category: safeCategory(searchParams.get("category")),
    fromYear,
    toYear,
    sort: enumValue(searchParams.get("sort"), SEARCH_SORTS, "relevance"),
    order: enumValue(searchParams.get("order"), SEARCH_ORDERS, "descending"),
    start: boundedInteger(searchParams.get("start"), 0, 0, 1_000_000),
    limit: boundedInteger(searchParams.get("limit"), 20, 1, 50),
  };
}

function quotedTerm(prefix: string, value: string) {
  return `${prefix}:"${value}"`;
}

function textExpression(
  value: string,
  prefix: string,
  match: ArxivSearchMatch,
) {
  if (match === "phrase") return quotedTerm(prefix, value);
  const terms = value.split(/\s+/).filter(Boolean).slice(0, 16);
  const operator = match === "any" ? " OR " : " AND ";
  return terms.map((term) => quotedTerm(prefix, term)).join(operator);
}

export function buildArxivSearchQuery(
  params: ArxivSearchParams,
): ArxivUpstreamQuery {
  const directId = normalizeArxivId(params.q);
  if (directId) {
    return {
      idList: directId,
      sortBy: params.sort,
      sortOrder: params.order,
      start: params.start,
      limit: params.limit,
    };
  }

  const prefix = FIELD_PREFIX[params.field];
  const parts = [`(${textExpression(params.q, prefix, params.match)})`];
  if (params.exclude) {
    parts.push(`ANDNOT (${textExpression(params.exclude, prefix, "any")})`);
  }
  if (params.category) parts.push(`AND cat:${params.category}`);
  if (params.fromYear || params.toYear) {
    const from = params.fromYear ?? 1991;
    const to = params.toYear ?? new Date().getUTCFullYear() + 1;
    parts.push(
      `AND submittedDate:[${from}01010000 TO ${to}12312359]`,
    );
  }

  return {
    searchQuery: parts.join(" "),
    sortBy: params.sort,
    sortOrder: params.order,
    start: params.start,
    limit: params.limit,
  };
}
