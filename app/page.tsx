import { paperOrbitViewerFor } from "./access-control";
import { requireChatGPTUser } from "./chatgpt-auth";
import PaperOrbitClient from "./paper-orbit-client";

export const dynamic = "force-dynamic";

async function ProtectedPaperOrbit() {
  const user = await requireChatGPTUser("/");
  const viewer = paperOrbitViewerFor(user);
  return <PaperOrbitClient viewer={viewer} />;
}

export default function Home() {
  return <ProtectedPaperOrbit />;
}
