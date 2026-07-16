export const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1";
export const DEFAULT_OPENAI_MODEL = "gpt-5.6";

const MAX_BASE_URL_LENGTH = 512;
const MAX_API_KEY_LENGTH = 512;
const MAX_MODEL_LENGTH = 128;

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "metadata",
  "metadata.aws.internal",
  "metadata.azure.internal",
  "metadata.google.internal",
  "instance-data",
  "kubernetes.default.svc",
]);

const BLOCKED_HOST_SUFFIXES = [
  ".localhost",
  ".local",
  ".internal",
  ".lan",
  ".home",
  ".home.arpa",
  ".cluster.local",
  ".svc",
];

function isBlockedIpv4(hostname: string) {
  const parts = hostname.split(".");
  if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/.test(part))) {
    return false;
  }

  const octets = parts.map(Number);
  if (octets.some((octet) => octet < 0 || octet > 255)) return true;
  const [first, second, third] = octets;

  return (
    first === 0
    || first === 10
    || (first === 100 && second >= 64 && second <= 127)
    || first === 127
    || (first === 169 && second === 254)
    || (first === 172 && second >= 16 && second <= 31)
    || (first === 192 && second === 0 && third === 0)
    || (first === 192 && second === 0 && third === 2)
    || (first === 192 && second === 168)
    || (first === 198 && (second === 18 || second === 19))
    || (first === 198 && second === 51 && third === 100)
    || (first === 203 && second === 0 && third === 113)
    || first >= 224
  );
}

function isBlockedHostname(hostname: string) {
  const normalized = hostname.toLowerCase();
  if (!normalized || normalized.endsWith(".")) return true;
  if (BLOCKED_HOSTNAMES.has(normalized)) return true;
  if (BLOCKED_HOST_SUFFIXES.some((suffix) => normalized.endsWith(suffix))) {
    return true;
  }

  // Literal IPv6 hosts are deliberately disallowed. A public DNS name keeps the
  // validation boundary auditable and avoids compressed/private IPv6 bypasses.
  if (normalized.includes(":")) return true;
  return isBlockedIpv4(normalized);
}

export function normalizeOpenAIBaseUrl(value: unknown) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw || raw.length > MAX_BASE_URL_LENGTH) return null;

  try {
    const url = new URL(raw);
    if (url.protocol !== "https:") return null;
    if (url.username || url.password || url.search || url.hash) return null;
    if (url.port && url.port !== "443") return null;
    if (isBlockedHostname(url.hostname)) return null;

    const pathname = url.pathname.replace(/\/+$/g, "");
    return `${url.origin}${pathname}`;
  } catch {
    return null;
  }
}

export function cleanOpenAIApiKey(value: unknown) {
  if (typeof value !== "string") return "";
  const apiKey = value.trim();
  if (!apiKey || apiKey.length > MAX_API_KEY_LENGTH || /[\u0000-\u0020\u007f]/.test(apiKey)) {
    return "";
  }
  return apiKey;
}

export function cleanOpenAIModel(value: unknown) {
  if (typeof value !== "string") return "";
  const model = value.trim();
  if (!model || model.length > MAX_MODEL_LENGTH) return "";
  return /[\u0000-\u0020\u007f]/.test(model) ? "" : model;
}

export function openAIProviderEndpoint(baseUrl: string, path: "models" | "responses") {
  return `${baseUrl}/${path}`;
}
