import { paperOrbitViewerFor } from "./access-control";
import {
  chatGPTSignOutPath,
  requireChatGPTUser,
} from "./chatgpt-auth";
import PaperOrbitClient from "./paper-orbit-client";

export const dynamic = "force-dynamic";

async function ProtectedPaperOrbit() {
  const user = await requireChatGPTUser("/");
  const viewer = paperOrbitViewerFor(user);

  if (!viewer) {
    return (
      <main className="access-page">
        <section className="access-card" aria-labelledby="access-title">
          <span className="orbit-mark access-orbit" aria-hidden="true">
            <span className="orbit-core" />
            <span className="orbit-planet" />
          </span>
          <p className="eyebrow">PAPER ORBIT / PRIVATE ACCESS</p>
          <h1 id="access-title">这个账号尚未获得访问权限</h1>
          <p>
            当前登录账号 <strong>{user.email}</strong> 不在 Paper Orbit
            的两人白名单中。请切换到受邀的 ChatGPT 账号后重试。
          </p>
          <a className="primary-link" href={chatGPTSignOutPath("/")}>
            退出并切换账号
          </a>
        </section>
      </main>
    );
  }

  return <PaperOrbitClient viewer={viewer} />;
}

export default function Home() {
  return <ProtectedPaperOrbit />;
}
