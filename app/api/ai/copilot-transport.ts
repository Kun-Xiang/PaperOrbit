import { type OpenAICredential } from "./openai-session";
import { openAIProviderEndpoint } from "./provider-config";
import {
  readBoundedResponseText,
  ResponseBodyTooLargeError,
} from "./bounded-response";

export type OpenAIUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
};

export type ProviderTransport = "json" | "sse";
export type ProviderPhase = "fulltext" | "repair" | "diagnostic";
export type ProviderFailureKind =
  | "http"
  | "timeout"
  | "network"
  | "format"
  | "empty"
  | "stream-error"
  | "too-large";

export type ProviderCallResult = {
  answer: string;
  usage: OpenAIUsage | null;
  transport: ProviderTransport;
  requestId: string | null;
  elapsedMs: number;
};

export type ArxivPdfProbe = {
  available: true;
  status: number;
  contentType: string;
  bytes: number | null;
  elapsedMs: number;
};

const MAX_PROVIDER_ERROR_BODY = 32_000;
const MAX_PROVIDER_ERROR_MESSAGE = 600;
const MAX_PROVIDER_SUCCESS_BODY = 4 * 1024 * 1024;
const MAX_PROVIDER_REQUEST_ID_LENGTH = 120;
const MAX_ARXIV_PDF_BYTES = 50 * 1024 * 1024;
const PROVIDER_REQUEST_ID_HEADERS = [
  "x-request-id",
  "request-id",
  "x-amzn-requestid",
  "cf-ray",
];

function elapsedSince(startedAt: number) {
  return Math.max(0, Math.round(performance.now() - startedAt));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function safeIdentifier(value: unknown) {
  if (typeof value !== "string") return null;
  const clean = value.trim().slice(0, 120);
  return clean && /^[a-z0-9_.:/-]+$/i.test(clean) ? clean : null;
}

function safeProviderMessage(value: unknown) {
  if (typeof value !== "string") return "";
  return value
    .replace(/bearer\s+[^\s,;]+/gi, "Bearer ***")
    .replace(/\bsk-[a-z0-9_-]+\b/gi, "sk-***")
    .replace(/([?&](?:key|token|api_key)=)[^&\s]+/gi, "$1***")
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_PROVIDER_ERROR_MESSAGE);
}

function providerErrorFields(raw: string) {
  let payload: unknown = null;
  try {
    payload = JSON.parse(raw);
  } catch {
    // Some compatible gateways return plain-text errors.
  }

  const root = isRecord(payload) ? payload : null;
  const nested = root && isRecord(root.error) ? root.error : null;
  const message = safeProviderMessage(
    nested?.message
      ?? root?.message
      ?? nested?.detail
      ?? root?.detail
      ?? raw,
  );
  return {
    message,
    code: safeIdentifier(nested?.code ?? root?.code),
    type: safeIdentifier(nested?.type ?? root?.type),
  };
}

function safeProviderRequestId(value: string | null, apiKey: string) {
  const candidate = value?.trim() ?? "";
  if (
    !candidate
    || candidate.length > MAX_PROVIDER_REQUEST_ID_LENGTH
    || !/^[a-z0-9][a-z0-9_.:/-]*$/i.test(candidate)
  ) {
    return null;
  }

  if (
    /^bearer/i.test(candidate)
    || /\bsk-[a-z0-9_-]+\b/i.test(candidate)
    || /(?:api[_-]?key|token)[=:_-]/i.test(candidate)
    || candidate === apiKey
    || (apiKey.length >= 4 && candidate.includes(apiKey))
    || /^[a-f0-9]{48,}$/i.test(candidate)
    || /^[a-z0-9_-]{96,}$/i.test(candidate)
  ) {
    return null;
  }

  return candidate;
}

function responseRequestId(response: Response, apiKey: string) {
  for (const header of PROVIDER_REQUEST_ID_HEADERS) {
    const requestId = safeProviderRequestId(
      response.headers.get(header),
      apiKey,
    );
    if (requestId) return requestId;
  }
  return null;
}

function isTimeoutError(error: unknown) {
  if (!(error instanceof Error)) return false;
  return error.name === "TimeoutError"
    || error.name === "AbortError"
    || /timed?\s*out|timeout/i.test(error.message);
}

function isRetryableStatus(status: number | null) {
  return status === null || [408, 409, 425, 500, 502, 503, 504].includes(status);
}

export class ProviderCallError extends Error {
  readonly kind: ProviderFailureKind;
  readonly phase: ProviderPhase;
  readonly status: number | null;
  readonly providerCode: string | null;
  readonly providerType: string | null;
  readonly providerMessage: string;
  readonly requestId: string | null;
  readonly transport: ProviderTransport;
  readonly elapsedMs: number;
  readonly retryable: boolean;
  attempts = 1;

  constructor(options: {
    kind: ProviderFailureKind;
    phase: ProviderPhase;
    status?: number | null;
    providerCode?: string | null;
    providerType?: string | null;
    providerMessage?: string;
    requestId?: string | null;
    transport: ProviderTransport;
    elapsedMs: number;
  }) {
    const status = options.status ?? null;
    super(`Provider ${options.phase} request failed (${options.kind}${status ? ` ${status}` : ""})`);
    this.name = "ProviderCallError";
    this.kind = options.kind;
    this.phase = options.phase;
    this.status = status;
    this.providerCode = options.providerCode ?? null;
    this.providerType = options.providerType ?? null;
    this.providerMessage = options.providerMessage ?? "";
    this.requestId = options.requestId ?? null;
    this.transport = options.transport;
    this.elapsedMs = options.elapsedMs;
    this.retryable = isRetryableStatus(status) || options.kind === "timeout" || options.kind === "network";
  }
}

export type ArxivPdfFailureKind =
  | "timeout"
  | "network"
  | "not-found"
  | "rate-limited"
  | "upstream"
  | "invalid-pdf"
  | "too-large"
  | "size-unknown";

export class ArxivPdfError extends Error {
  readonly kind: ArxivPdfFailureKind;
  readonly status: number | null;
  readonly elapsedMs: number;
  readonly retryable: boolean;

  constructor(kind: ArxivPdfFailureKind, status: number | null, elapsedMs: number) {
    super(`arXiv PDF probe failed (${kind}${status ? ` ${status}` : ""})`);
    this.name = "ArxivPdfError";
    this.kind = kind;
    this.status = status;
    this.elapsedMs = elapsedMs;
    this.retryable = kind === "timeout"
      || kind === "network"
      || kind === "rate-limited"
      || kind === "upstream"
      || kind === "size-unknown";
  }
}

function directContentLength(response: Response) {
  const raw = response.headers.get("content-length")?.trim() ?? "";
  if (!/^\d+$/.test(raw)) return null;
  const direct = Number(raw);
  if (Number.isSafeInteger(direct) && direct >= 0) return direct;
  return null;
}

function totalLengthFromContentRange(response: Response) {
  const raw = response.headers.get("content-range")?.trim() ?? "";
  const range = raw.match(/^bytes\s+\d+-\d+\/(\d+)$/i);
  if (!range) return null;
  const total = Number(range[1]);
  if (Number.isSafeInteger(total) && total >= 0) return total;
  return null;
}

function ensureAllowedArxivResponse(response: Response, startedAt: number) {
  if (!response.url) return;
  try {
    const url = new URL(response.url);
    if (
      url.protocol !== "https:"
      || (url.hostname !== "arxiv.org" && url.hostname !== "export.arxiv.org")
    ) {
      throw new ArxivPdfError("invalid-pdf", response.status, elapsedSince(startedAt));
    }
  } catch (error) {
    if (error instanceof ArxivPdfError) throw error;
    throw new ArxivPdfError("invalid-pdf", response.status, elapsedSince(startedAt));
  }
}

function classifyArxivStatus(status: number, startedAt: number): never {
  const elapsedMs = elapsedSince(startedAt);
  if (status === 404 || status === 410) {
    throw new ArxivPdfError("not-found", status, elapsedMs);
  }
  if (status === 429) {
    throw new ArxivPdfError("rate-limited", status, elapsedMs);
  }
  throw new ArxivPdfError("upstream", status, elapsedMs);
}

async function firstBytes(response: Response, count: number) {
  if (!response.body) return new Uint8Array();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (total < count) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value?.length) {
        chunks.push(value);
        total += value.length;
      }
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
  const output = new Uint8Array(Math.min(total, count));
  let offset = 0;
  for (const chunk of chunks) {
    const remaining = output.length - offset;
    if (remaining <= 0) break;
    const slice = chunk.subarray(0, remaining);
    output.set(slice, offset);
    offset += slice.length;
  }
  return output;
}

function hasPdfMagic(bytes: Uint8Array) {
  return bytes.length >= 5
    && bytes[0] === 0x25
    && bytes[1] === 0x50
    && bytes[2] === 0x44
    && bytes[3] === 0x46
    && bytes[4] === 0x2d;
}

function validatePdfSize(bytes: number | null, status: number, startedAt: number) {
  if (bytes === 0) {
    throw new ArxivPdfError("invalid-pdf", status, elapsedSince(startedAt));
  }
  if (bytes !== null && bytes > MAX_ARXIV_PDF_BYTES) {
    throw new ArxivPdfError("too-large", status, elapsedSince(startedAt));
  }
}

export async function probeArxivPdf(pdfUrl: string): Promise<ArxivPdfProbe> {
  const startedAt = performance.now();
  let response: Response;
  try {
    response = await fetch(pdfUrl, {
      method: "HEAD",
      headers: { Accept: "application/pdf" },
      redirect: "follow",
      signal: AbortSignal.timeout(15_000),
    });
  } catch (error) {
    throw new ArxivPdfError(
      isTimeoutError(error) ? "timeout" : "network",
      null,
      elapsedSince(startedAt),
    );
  }

  ensureAllowedArxivResponse(response, startedAt);
  let headBytes: number | null = null;
  if (response.ok) {
    headBytes = directContentLength(response);
    validatePdfSize(headBytes, response.status, startedAt);
  } else if (![400, 403, 405, 501].includes(response.status)) {
    classifyArxivStatus(response.status, startedAt);
  }

  try {
    response = await fetch(pdfUrl, {
      method: "GET",
      headers: {
        Accept: "application/pdf",
        Range: "bytes=0-7",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(20_000),
    });
  } catch (error) {
    throw new ArxivPdfError(
      isTimeoutError(error) ? "timeout" : "network",
      null,
      elapsedSince(startedAt),
    );
  }

  ensureAllowedArxivResponse(response, startedAt);
  if (!response.ok) classifyArxivStatus(response.status, startedAt);
  const type = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (
    type
    && !type.includes("application/pdf")
    && !type.includes("application/octet-stream")
  ) {
    throw new ArxivPdfError("invalid-pdf", response.status, elapsedSince(startedAt));
  }
  const signature = await firstBytes(response, 8);
  if (!hasPdfMagic(signature)) {
    throw new ArxivPdfError("invalid-pdf", response.status, elapsedSince(startedAt));
  }
  const rangeBytes = totalLengthFromContentRange(response);
  const directBytes = response.status === 200
    ? directContentLength(response)
    : null;
  const bytes = rangeBytes ?? directBytes ?? headBytes;
  if (bytes === null) {
    throw new ArxivPdfError("size-unknown", response.status, elapsedSince(startedAt));
  }
  validatePdfSize(bytes, response.status, startedAt);
  return {
    available: true,
    status: response.status,
    contentType: "application/pdf",
    bytes,
    elapsedMs: elapsedSince(startedAt),
  };
}

export function extractOutputText(payload: unknown) {
  if (!isRecord(payload)) return "";
  if (typeof payload.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text.trim();
  }
  if (!Array.isArray(payload.output)) return "";
  const parts: string[] = [];
  for (const item of payload.output) {
    if (!isRecord(item) || !Array.isArray(item.content)) continue;
    for (const part of item.content) {
      if (!isRecord(part)) continue;
      if (typeof part.text === "string" && part.text.trim()) parts.push(part.text.trim());
      if (typeof part.refusal === "string" && part.refusal.trim()) parts.push(part.refusal.trim());
    }
  }
  return parts.join("\n").trim();
}

export function extractUsage(payload: unknown): OpenAIUsage | null {
  if (!isRecord(payload) || !isRecord(payload.usage)) return null;
  const number = (value: unknown) =>
    typeof value === "number" && Number.isFinite(value) && value >= 0
      ? Math.round(value)
      : 0;
  const inputTokens = number(payload.usage.input_tokens);
  const outputTokens = number(payload.usage.output_tokens);
  const totalTokens = number(payload.usage.total_tokens) || inputTokens + outputTokens;
  return { inputTokens, outputTokens, totalTokens };
}

function sseDataBlocks(raw: string) {
  return raw
    .replace(/\r\n/g, "\n")
    .split(/\n\n+/)
    .map((block) => block
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart())
      .join("\n"))
    .filter(Boolean);
}

function parseSseResponse(
  raw: string,
  options: {
    phase: ProviderPhase;
    requestId: string | null;
    elapsedMs: number;
  },
) {
  let answer = "";
  let completed: unknown = null;
  let usage: OpenAIUsage | null = null;

  for (const data of sseDataBlocks(raw)) {
    if (data === "[DONE]") continue;
    let payload: unknown;
    try {
      payload = JSON.parse(data);
    } catch {
      continue;
    }
    if (!isRecord(payload)) continue;
    const type = typeof payload.type === "string" ? payload.type : "";
    if (type === "response.output_text.delta" && typeof payload.delta === "string") {
      answer += payload.delta;
    } else if (isRecord(payload.choices) || Array.isArray(payload.choices)) {
      const choice = Array.isArray(payload.choices) && isRecord(payload.choices[0])
        ? payload.choices[0]
        : null;
      const delta = choice && isRecord(choice.delta) ? choice.delta.content : null;
      if (typeof delta === "string") answer += delta;
    }

    if (type === "response.completed" && isRecord(payload.response)) {
      completed = payload.response;
      usage = extractUsage(payload.response);
    }
    if (type === "response.failed" || type === "error") {
      const fields = providerErrorFields(JSON.stringify(payload));
      throw new ProviderCallError({
        kind: "stream-error",
        phase: options.phase,
        status: 502,
        providerCode: fields.code,
        providerType: fields.type,
        providerMessage: fields.message,
        requestId: options.requestId,
        transport: "sse",
        elapsedMs: options.elapsedMs,
      });
    }
  }

  const completedAnswer = extractOutputText(completed);
  return {
    answer: completedAnswer || answer.trim(),
    usage: usage ?? extractUsage(completed),
  };
}

export async function requestProviderResponse(
  credential: OpenAICredential,
  options: {
    instructions: string;
    input: unknown;
    maxOutputTokens: number;
    phase: ProviderPhase;
    preferStreaming: boolean;
    diagnosticId: string;
    timeoutMs: number;
  },
): Promise<ProviderCallResult> {
  const startedAt = performance.now();
  const requestedTransport: ProviderTransport = options.preferStreaming ? "sse" : "json";
  let response: Response;
  try {
    response = await fetch(openAIProviderEndpoint(credential.baseUrl, "responses"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${credential.apiKey}`,
        "X-Client-Request-Id": options.diagnosticId,
      },
      redirect: "manual",
      signal: AbortSignal.timeout(options.timeoutMs),
      body: JSON.stringify({
        model: credential.model,
        instructions: options.instructions,
        input: options.input,
        max_output_tokens: options.maxOutputTokens,
        stream: options.preferStreaming,
        store: false,
      }),
    });
  } catch (error) {
    throw new ProviderCallError({
      kind: isTimeoutError(error) ? "timeout" : "network",
      phase: options.phase,
      transport: requestedTransport,
      elapsedMs: elapsedSince(startedAt),
    });
  }

  const requestId = responseRequestId(response, credential.apiKey);
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  let raw = "";
  try {
    const body = await readBoundedResponseText(
      response,
      response.ok ? MAX_PROVIDER_SUCCESS_BODY : MAX_PROVIDER_ERROR_BODY,
      { truncate: !response.ok },
    );
    raw = body.text;
  } catch (error) {
    if (error instanceof ResponseBodyTooLargeError) {
      throw new ProviderCallError({
        kind: "too-large",
        phase: options.phase,
        status: response.status,
        requestId,
        transport: contentType.includes("text/event-stream") ? "sse" : requestedTransport,
        elapsedMs: elapsedSince(startedAt),
      });
    }
    throw new ProviderCallError({
      kind: isTimeoutError(error) ? "timeout" : "network",
      phase: options.phase,
      status: response.status,
      requestId,
      transport: contentType.includes("text/event-stream") ? "sse" : requestedTransport,
      elapsedMs: elapsedSince(startedAt),
    });
  }

  const transport: ProviderTransport = contentType.includes("text/event-stream")
    || /^\s*(?:event:|data:)/.test(raw)
    ? "sse"
    : "json";
  const elapsedMs = elapsedSince(startedAt);
  if (!response.ok) {
    const fields = providerErrorFields(raw.slice(0, MAX_PROVIDER_ERROR_BODY));
    throw new ProviderCallError({
      kind: "http",
      phase: options.phase,
      status: response.status,
      providerCode: fields.code,
      providerType: fields.type,
      providerMessage: fields.message,
      requestId,
      transport,
      elapsedMs,
    });
  }

  let answer = "";
  let usage: OpenAIUsage | null = null;
  if (transport === "sse") {
    const parsed = parseSseResponse(raw, { phase: options.phase, requestId, elapsedMs });
    answer = parsed.answer;
    usage = parsed.usage;
  } else {
    let payload: unknown;
    try {
      payload = JSON.parse(raw);
    } catch {
      throw new ProviderCallError({
        kind: "format",
        phase: options.phase,
        status: response.status,
        requestId,
        transport,
        elapsedMs,
      });
    }
    answer = extractOutputText(payload);
    usage = extractUsage(payload);
  }

  if (!answer) {
    throw new ProviderCallError({
      kind: "empty",
      phase: options.phase,
      status: response.status,
      requestId,
      transport,
      elapsedMs,
    });
  }
  return { answer, usage, transport, requestId, elapsedMs };
}

export function providerErrorMentions(error: ProviderCallError, pattern: RegExp) {
  return pattern.test(
    [error.providerCode, error.providerType, error.providerMessage]
      .filter(Boolean)
      .join(" "),
  );
}
