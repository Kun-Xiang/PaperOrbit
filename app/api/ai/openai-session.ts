const SESSION_COOKIE = "paper_orbit_openai_session";
const SESSION_VERSION = "v1";
const SESSION_AAD = new TextEncoder().encode("paper-orbit-openai-session-v1");
const SESSION_MAX_AGE_MS = 12 * 60 * 60 * 1000;

type StoredOpenAISession = {
  apiKey: string;
  connectedAt: string;
  subject: string;
};

export type OpenAICredential = {
  apiKey: string;
  source: "session" | "shared";
};

function sessionSecret() {
  const secret = process.env.PAPER_ORBIT_SESSION_SECRET?.trim() ?? "";
  return secret.length >= 32 ? secret : "";
}

export function openAISessionAvailable() {
  return Boolean(sessionSecret());
}

export function openAIModel() {
  return process.env.OPENAI_MODEL?.trim() || "gpt-5.6";
}

function encodeBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/g, "");
}

function decodeBase64Url(value: string) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function encryptionKey() {
  const secret = sessionSecret();
  if (!secret) throw new Error("Paper Orbit AI sessions are not configured");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
}

function cookieValue(request: Request) {
  const cookies = request.headers.get("cookie") ?? "";
  for (const part of cookies.split(";")) {
    const [name, ...value] = part.trim().split("=");
    if (name === SESSION_COOKIE) return value.join("=");
  }
  return "";
}

function requestSubject(request: Request) {
  return request.headers.get("oai-authenticated-user-email")?.trim().toLowerCase() ?? "";
}

export async function sealOpenAISession(request: Request, apiKey: string) {
  const subject = requestSubject(request);
  if (!subject) throw new Error("Paper Orbit AI sessions require an authenticated user");
  const payload: StoredOpenAISession = {
    apiKey,
    connectedAt: new Date().toISOString(),
    subject,
  };
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: SESSION_AAD },
    await encryptionKey(),
    new TextEncoder().encode(JSON.stringify(payload)),
  );
  return `${SESSION_VERSION}.${encodeBase64Url(iv)}.${encodeBase64Url(new Uint8Array(encrypted))}`;
}

export async function readOpenAISession(request: Request) {
  const value = cookieValue(request);
  if (!value || !sessionSecret()) return null;
  const [version, encodedIv, encodedPayload, extra] = value.split(".");
  if (version !== SESSION_VERSION || !encodedIv || !encodedPayload || extra) return null;

  try {
    const decrypted = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: decodeBase64Url(encodedIv),
        additionalData: SESSION_AAD,
      },
      await encryptionKey(),
      decodeBase64Url(encodedPayload),
    );
    const payload = JSON.parse(new TextDecoder().decode(decrypted)) as Partial<StoredOpenAISession>;
    if (typeof payload.apiKey !== "string" || payload.apiKey.length < 20) return null;
    if (payload.subject !== requestSubject(request)) return null;
    const connectedAt = typeof payload.connectedAt === "string" ? Date.parse(payload.connectedAt) : Number.NaN;
    const age = Date.now() - connectedAt;
    if (!Number.isFinite(connectedAt) || age < -60_000 || age > SESSION_MAX_AGE_MS) return null;
    return payload as StoredOpenAISession;
  } catch {
    return null;
  }
}

export async function openAICredential(request: Request): Promise<OpenAICredential | null> {
  const session = await readOpenAISession(request);
  if (session) return { apiKey: session.apiKey, source: "session" };

  const sharedKey = process.env.OPENAI_API_KEY?.trim();
  return sharedKey ? { apiKey: sharedKey, source: "shared" } : null;
}

function secureAttribute(request: Request) {
  const { hostname, protocol } = new URL(request.url);
  return protocol === "https:" || (hostname !== "localhost" && hostname !== "127.0.0.1")
    ? "; Secure"
    : "";
}

export function openAISessionCookie(request: Request, sealedSession: string) {
  return `${SESSION_COOKIE}=${sealedSession}; Path=/api/ai; HttpOnly; SameSite=Strict${secureAttribute(request)}`;
}

export function clearOpenAISessionCookie(request: Request) {
  return `${SESSION_COOKIE}=; Path=/api/ai; HttpOnly; SameSite=Strict; Max-Age=0${secureAttribute(request)}`;
}
