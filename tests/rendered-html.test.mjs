import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function request(path = "/", email = "xiangk123@gmail.com", init = {}) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set(
    "test",
    `${process.pid}-${Date.now()}-${path}-${email ?? "anonymous"}`,
  );
  const { default: worker } = await import(workerUrl.href);

  const requestHeaders = new Headers(init.headers);
  if (!requestHeaders.has("accept")) requestHeaders.set("accept", "text/html");
  if (email) requestHeaders.set("oai-authenticated-user-email", email);

  return worker.fetch(
    new Request(`http://localhost${path}`, {
      ...init,
      headers: requestHeaders,
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the Paper Orbit product shell", async () => {
  const response = await request();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Paper Orbit — 每日论文阅读与 AI 研究助手<\/title>/i);
  assert.match(html, /Paper Orbit/);
  assert.match(html, /今天值得读的/);
  assert.match(html, />10<\/em> 篇/);
  assert.match(html, /Paper Copilot/);
  assert.match(html, /搜索 arXiv/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|Codex is working/i);
});

test("allows only the owner and manager ChatGPT accounts", async () => {
  const managerResponse = await request("/", "xumiaojun49@gmail.com");
  assert.equal(managerResponse.status, 200);
  const managerHtml = await managerResponse.text();
  assert.match(managerHtml, /Miaojun Xu/);
  assert.match(managerHtml, /MANAGER/);
  assert.match(managerHtml, /Paper Copilot/);

  const outsiderResponse = await request("/", "outsider@example.com");
  assert.equal(outsiderResponse.status, 200);
  const outsiderHtml = await outsiderResponse.text();
  assert.match(outsiderHtml, /这个账号尚未获得访问权限/);
  assert.match(outsiderHtml, /outsider@example\.com/);
  assert.doesNotMatch(outsiderHtml, /Paper Copilot/);

  const anonymousApi = await request("/api/arxiv?mode=feed", null);
  assert.equal(anonymousApi.status, 401);
  const outsiderApi = await request(
    "/api/arxiv?mode=feed",
    "outsider@example.com",
  );
  assert.equal(outsiderApi.status, 403);
});

test("keeps Copilot output in one language without copying the abstract", async () => {
  const abstract =
    "We introduce a deliberately distinctive sequence of source words that should never be copied into the generated reading report. Our framework combines visual observations with actions and predicts future latent states under several training objectives. Extensive experiments compare the method with strong baselines across multiple settings.";
  const paper = {
    id: "2607.00001",
    title: "A Test Paper for Language Quality",
    authors: ["Researcher One"],
    summary: abstract,
    category: "cs.RO",
    tags: ["Physical AI", "VLA", "World Models"],
  };

  const reportResponse = await request("/api/ai", "xumiaojun49@gmail.com", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      paper,
      action: "report",
      prompt: "请用中文生成报告，不要复述摘要。",
    }),
  });
  assert.equal(reportResponse.status, 200);
  const report = await reportResponse.json();
  assert.equal(report.mode, "preview");
  assert.match(report.answer, /摘要辅助模式/);
  assert.doesNotMatch(report.answer, /deliberately distinctive sequence/i);
  assert.doesNotMatch(
    report.answer,
    /(?:[A-Za-z][A-Za-z0-9'-]*[\s,.;:()—-]+){11}[A-Za-z][A-Za-z0-9'-]*/,
  );

  const chatResponse = await request("/api/ai", "xiangk123@gmail.com", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      paper,
      action: "chat",
      prompt: "What is the core mechanism?",
    }),
  });
  assert.equal(chatResponse.status, 200);
  const chat = await chatResponse.json();
  assert.equal(chat.mode, "preview");
  assert.doesNotMatch(chat.answer, /[\u3400-\u9fff]/);
  assert.doesNotMatch(chat.answer, /deliberately distinctive sequence/i);
});

test("ships ten fallback papers and the multi-signal recommendation pipeline", async () => {
  const [page, client, access, route, aiRoute, recommendation, layout] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/paper-orbit-client.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/access-control.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/arxiv/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/ai/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/arxiv/recommendation.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(client, /const DAILY_PAPER_COUNT = 10/);
  assert.equal((client.match(/id: "2607\./g) ?? []).length, 10);
  assert.match(client, /paper-orbit:affinity-v2/);
  assert.match(page, /requireChatGPTUser/);
  assert.match(access, /xiangk123@gmail\.com/);
  assert.match(access, /xumiaojun49@gmail\.com/);
  assert.match(route, /paperOrbitApiAccessError/);
  assert.match(route, /max_results", mode === "feed" \? "60"/);
  assert.match(route, /api\.semanticscholar\.org\/graph\/v1\/paper\/batch/);
  assert.match(route, /dailyLimit: 10/);
  assert.match(aiRoute, /不得连续复用摘要中十二个或更多英文单词/);
  assert.match(aiRoute, /violatesOutputPolicy/);
  assert.match(aiRoute, /repairInstructions/);
  assert.match(recommendation, /relevance \* 0\.42/);
  assert.match(recommendation, /overlap \* 0\.16/);
  assert.match(layout, /Paper Orbit/);
  assert.doesNotMatch(client, /_sites-preview|SkeletonPreview/);
});
