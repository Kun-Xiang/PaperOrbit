import { isPaperOrbitPrivilegedEmail } from "../../access-control";
import {
  clearEncryptedSessionCookie,
  encryptedSessionCookie,
  encryptedSessionsAvailable,
  readEncryptedSession,
  requestSubject,
  sealEncryptedSession,
} from "../encrypted-session";

const SESSION_COOKIE = "paper_orbit_semantic_scholar_session";
const SESSION_SCOPE = "semantic-scholar-session";
const SESSION_PATH = "/api/arxiv";

type StoredResearchSession = {
  semanticScholarApiKey: string;
};

export type SemanticScholarCredential = {
  apiKey: string;
  source: "session" | "shared";
};

function isStoredResearchSession(
  value: unknown,
): value is StoredResearchSession {
  if (!value || typeof value !== "object") return false;
  const apiKey = (value as { semanticScholarApiKey?: unknown })
    .semanticScholarApiKey;
  return typeof apiKey === "string" && apiKey.length >= 16;
}

export function researchSessionAvailable() {
  return encryptedSessionsAvailable();
}

export async function sealResearchSession(
  request: Request,
  semanticScholarApiKey: string,
) {
  return sealEncryptedSession<StoredResearchSession>(
    request,
    SESSION_SCOPE,
    { semanticScholarApiKey },
  );
}

export async function readResearchSession(request: Request) {
  const session = await readEncryptedSession(
    request,
    SESSION_COOKIE,
    SESSION_SCOPE,
    isStoredResearchSession,
  );
  if (!session) return null;
  return {
    semanticScholarApiKey: session.data.semanticScholarApiKey,
    connectedAt: session.connectedAt,
    subject: session.subject,
  };
}

export function sharedSemanticScholarCredential(
  request: Request,
): SemanticScholarCredential | null {
  if (!isPaperOrbitPrivilegedEmail(requestSubject(request))) return null;
  const sharedKey = process.env.SEMANTIC_SCHOLAR_API_KEY?.trim();
  return sharedKey ? { apiKey: sharedKey, source: "shared" } : null;
}

export async function semanticScholarCredential(
  request: Request,
): Promise<SemanticScholarCredential | null> {
  const session = await readResearchSession(request);
  if (session) {
    return {
      apiKey: session.semanticScholarApiKey,
      source: "session",
    };
  }
  return sharedSemanticScholarCredential(request);
}

export function researchSessionCookie(
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

export function clearResearchSessionCookie(request: Request) {
  return clearEncryptedSessionCookie(
    request,
    SESSION_COOKIE,
    SESSION_PATH,
  );
}
