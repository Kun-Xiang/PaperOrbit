import {
  isLocalDevelopmentRequest,
  localDevelopmentIdentityFromRequest,
} from "../local-development";

const SESSION_VERSION = "v1";
const SESSION_MAX_AGE_MS = 12 * 60 * 60 * 1000;
const LOCAL_SESSION_MAX_AGE_SECONDS = 90 * 24 * 60 * 60;

type SessionEnvelope<T> = {
  connectedAt: string;
  data: T;
  subject: string;
};

function sessionSecret() {
  const secret = process.env.PAPER_ORBIT_SESSION_SECRET?.trim() ?? "";
  return secret.length >= 32 ? secret : "";
}

export function encryptedSessionsAvailable() {
  return Boolean(sessionSecret());
}

export function requestSubject(request: Request) {
  const authenticatedSubject = request.headers
    .get("oai-authenticated-user-email")
    ?.trim()
    .toLowerCase();
  return authenticatedSubject
    || localDevelopmentIdentityFromRequest(request)?.email
    || "";
}

function additionalData(scope: string) {
  return new TextEncoder().encode(`paper-orbit:${scope}:${SESSION_VERSION}`);
}

function sessionMaxAgeMs(request: Request) {
  return isLocalDevelopmentRequest(request)
    ? LOCAL_SESSION_MAX_AGE_SECONDS * 1000
    : SESSION_MAX_AGE_MS;
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
  if (!secret) throw new Error("Paper Orbit encrypted sessions are not configured");
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(secret),
  );
  return crypto.subtle.importKey(
    "raw",
    digest,
    "AES-GCM",
    false,
    ["encrypt", "decrypt"],
  );
}

function cookieValue(request: Request, cookieName: string) {
  const cookies = request.headers.get("cookie") ?? "";
  for (const part of cookies.split(";")) {
    const [name, ...value] = part.trim().split("=");
    if (name === cookieName) return value.join("=");
  }
  return "";
}

export async function sealEncryptedSession<T>(
  request: Request,
  scope: string,
  data: T,
) {
  const subject = requestSubject(request);
  if (!subject) {
    throw new Error("Paper Orbit encrypted sessions require an authenticated user");
  }
  const payload: SessionEnvelope<T> = {
    connectedAt: new Date().toISOString(),
    data,
    subject,
  };
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: additionalData(scope) },
    await encryptionKey(),
    new TextEncoder().encode(JSON.stringify(payload)),
  );
  return `${SESSION_VERSION}.${encodeBase64Url(iv)}.${encodeBase64Url(new Uint8Array(encrypted))}`;
}

export async function readEncryptedSession<T>(
  request: Request,
  cookieName: string,
  scope: string,
  validateData: (data: unknown) => data is T,
) {
  const value = cookieValue(request, cookieName);
  if (!value || !sessionSecret()) return null;
  const [version, encodedIv, encodedPayload, extra] = value.split(".");
  if (version !== SESSION_VERSION || !encodedIv || !encodedPayload || extra) {
    return null;
  }

  try {
    const decrypted = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: decodeBase64Url(encodedIv),
        additionalData: additionalData(scope),
      },
      await encryptionKey(),
      decodeBase64Url(encodedPayload),
    );
    const payload = JSON.parse(
      new TextDecoder().decode(decrypted),
    ) as Partial<SessionEnvelope<unknown>>;
    if (payload.subject !== requestSubject(request)) return null;
    if (!validateData(payload.data)) return null;
    const connectedAt =
      typeof payload.connectedAt === "string"
        ? Date.parse(payload.connectedAt)
        : Number.NaN;
    const age = Date.now() - connectedAt;
    if (
      !Number.isFinite(connectedAt)
      || age < -60_000
      || age > sessionMaxAgeMs(request)
    ) {
      return null;
    }
    return {
      connectedAt: payload.connectedAt as string,
      data: payload.data,
      subject: payload.subject,
    } as SessionEnvelope<T>;
  } catch {
    return null;
  }
}

function secureAttribute(request: Request) {
  const { hostname, protocol } = new URL(request.url);
  return protocol === "https:"
    || (hostname !== "localhost" && hostname !== "127.0.0.1")
    ? "; Secure"
    : "";
}

function persistenceAttribute(request: Request) {
  return isLocalDevelopmentRequest(request)
    ? `; Max-Age=${LOCAL_SESSION_MAX_AGE_SECONDS}`
    : "";
}

export function encryptedSessionCookie(
  request: Request,
  cookieName: string,
  path: string,
  sealedSession: string,
) {
  return `${cookieName}=${sealedSession}; Path=${path}; HttpOnly; SameSite=Strict${persistenceAttribute(request)}${secureAttribute(request)}`;
}

export function clearEncryptedSessionCookie(
  request: Request,
  cookieName: string,
  path: string,
) {
  return `${cookieName}=; Path=${path}; HttpOnly; SameSite=Strict; Max-Age=0${secureAttribute(request)}`;
}
