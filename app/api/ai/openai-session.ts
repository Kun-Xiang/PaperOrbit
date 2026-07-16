import { isPaperOrbitPrivilegedEmail } from "../../access-control";
import {
  clearEncryptedSessionCookie,
  encryptedSessionCookie,
  encryptedSessionsAvailable,
  readEncryptedSession,
  requestSubject,
  sealEncryptedSession,
} from "../encrypted-session";

const SESSION_COOKIE = "paper_orbit_openai_session";
const SESSION_SCOPE = "openai-session";
const SESSION_PATH = "/api/ai";

type StoredOpenAISession = {
  apiKey: string;
};

export type OpenAICredential = {
  apiKey: string;
  source: "session" | "shared";
};

function isStoredOpenAISession(value: unknown): value is StoredOpenAISession {
  if (!value || typeof value !== "object") return false;
  const apiKey = (value as { apiKey?: unknown }).apiKey;
  return typeof apiKey === "string" && apiKey.length >= 20;
}

export function openAISessionAvailable() {
  return encryptedSessionsAvailable();
}

export function openAIModel() {
  return process.env.OPENAI_MODEL?.trim() || "gpt-5.6";
}

export async function sealOpenAISession(request: Request, apiKey: string) {
  return sealEncryptedSession<StoredOpenAISession>(
    request,
    SESSION_SCOPE,
    { apiKey },
  );
}

export async function readOpenAISession(request: Request) {
  const session = await readEncryptedSession(
    request,
    SESSION_COOKIE,
    SESSION_SCOPE,
    isStoredOpenAISession,
  );
  if (!session) return null;
  return {
    apiKey: session.data.apiKey,
    connectedAt: session.connectedAt,
    subject: session.subject,
  };
}

export function sharedOpenAICredential(
  request: Request,
): OpenAICredential | null {
  if (!isPaperOrbitPrivilegedEmail(requestSubject(request))) return null;
  const sharedKey = process.env.OPENAI_API_KEY?.trim();
  return sharedKey ? { apiKey: sharedKey, source: "shared" } : null;
}

export async function openAICredential(
  request: Request,
): Promise<OpenAICredential | null> {
  const session = await readOpenAISession(request);
  if (session) return { apiKey: session.apiKey, source: "session" };
  return sharedOpenAICredential(request);
}

export function openAISessionCookie(
  request: Request,
  sealedSession: string,
) {
  return encryptedSessionCookie(
    request,
    SESSION_COOKIE,
    SESSION_PATH,
    sealedSession,
  );
}

export function clearOpenAISessionCookie(request: Request) {
  return clearEncryptedSessionCookie(
    request,
    SESSION_COOKIE,
    SESSION_PATH,
  );
}
