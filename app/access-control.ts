import type { PaperOrbitViewer } from "./paper-orbit-client";
import {
  getChatGPTUser,
  type ChatGPTUser,
} from "./chatgpt-auth";

const PAPER_ORBIT_USERS: Record<
  string,
  { role: PaperOrbitViewer["role"]; fallbackName: string }
> = {
  "xiangk123@gmail.com": {
    role: "owner",
    fallbackName: "Kun Xiang",
  },
  "xumiaojun49@gmail.com": {
    role: "manager",
    fallbackName: "Miaojun Xu",
  },
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function initialsFor(name: string, email: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return `${Array.from(words[0])[0] ?? ""}${Array.from(words.at(-1) ?? "")[0] ?? ""}`.toUpperCase();
  }
  const characters = Array.from(words[0] ?? "");
  if (characters.length) return characters.slice(0, 2).join("").toUpperCase();
  return email.slice(0, 2).toUpperCase();
}

export function paperOrbitViewerFor(
  user: ChatGPTUser,
): PaperOrbitViewer | null {
  const email = normalizeEmail(user.email);
  const access = PAPER_ORBIT_USERS[email];
  if (!access) return null;
  const displayName = user.fullName?.trim() || access.fallbackName;
  return {
    displayName,
    email,
    initials: initialsFor(displayName, email),
    role: access.role,
  };
}

export async function paperOrbitApiAccessError() {
  const user = await getChatGPTUser();
  if (!user) {
    return Response.json(
      { error: "ChatGPT sign-in is required" },
      { status: 401 },
    );
  }
  if (!paperOrbitViewerFor(user)) {
    return Response.json(
      { error: "This ChatGPT account is not authorized for Paper Orbit" },
      { status: 403 },
    );
  }
  return null;
}
