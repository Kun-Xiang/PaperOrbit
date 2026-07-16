import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

process.env.PAPER_ORBIT_SESSION_SECRET =
  "paper-orbit-test-session-secret-with-more-than-32-characters";
process.env.OPENAI_MODEL = "gpt-5.6";
delete process.env.OPENAI_API_KEY;
delete process.env.SEMANTIC_SCHOLAR_API_KEY;

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
    new Request(`https://paper-orbit.test${path}`, {
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

async function withMockedFetch(mock, callback) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mock;
  try {
    return await callback();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

function atomFeed(entries, { total = entries.length, start = 0, limit = entries.length } = {}) {
  const body = entries.map((entry, index) => {
    const id = entry.id ?? `2607.${String(index + 1).padStart(5, "0")}`;
    return `
      <entry>
        <id>https://arxiv.org/abs/${id}</id>
        <updated>${entry.updated ?? "2026-07-15T00:00:00Z"}</updated>
        <published>${entry.published ?? "2026-07-14T00:00:00Z"}</published>
        <title>${entry.title ?? `Paper ${index + 1}`}</title>
        <summary>${entry.summary ?? "Robot learning with multimodal reasoning and extensive experiments."}</summary>
        <author><name>${entry.author ?? "Researcher"}</name></author>
        <category term="${entry.category ?? "cs.RO"}" />
      </entry>`;
  }).join("");
  return `<?xml version="1.0" encoding="UTF-8"?>
    <feed xmlns:opensearch="http://a9.com/-/spec/opensearch/1.1/">
      <opensearch:totalResults>${total}</opensearch:totalResults>
      <opensearch:startIndex>${start}</opensearch:startIndex>
      <opensearch:itemsPerPage>${limit}</opensearch:itemsPerPage>
      ${body}
    </feed>`;
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

test("allows every signed-in ChatGPT account while preserving privileged roles", async () => {
  const managerResponse = await request("/", "xumiaojun49@gmail.com");
  assert.equal(managerResponse.status, 200);
  const managerHtml = await managerResponse.text();
  assert.match(managerHtml, /Miaojun Xu/);
  assert.match(managerHtml, /MANAGER/);
  assert.match(managerHtml, /Paper Copilot/);

  const outsiderResponse = await request("/", "outsider@example.com");
  assert.equal(outsiderResponse.status, 200);
  const outsiderHtml = await outsiderResponse.text();
  assert.match(outsiderHtml, /outsider@example\.com/);
  assert.match(outsiderHtml, /READER/);
  assert.match(outsiderHtml, /Paper Copilot/);
  assert.doesNotMatch(outsiderHtml, /这个账号尚未获得访问权限/);

  const anonymousApi = await request("/api/arxiv?mode=feed", null);
  assert.equal(anonymousApi.status, 401);

  const missingQuery = await request("/api/arxiv", "outsider@example.com");
  assert.equal(missingQuery.status, 400);
  assert.equal(missingQuery.headers.get("cache-control"), "private, no-store");
});

test("keeps shared provider credentials exclusive to owner and manager accounts", async () => {
  process.env.OPENAI_API_KEY = "sk-test-shared-owner-key-not-for-readers";
  process.env.SEMANTIC_SCHOLAR_API_KEY =
    "semantic-scholar-test-shared-owner-key";

  try {
    const readerAiResponse = await request(
      "/api/ai/session",
      "reader@example.com",
    );
    assert.equal(readerAiResponse.status, 200);
    const readerAi = await readerAiResponse.json();
    assert.equal(readerAi.connected, false);
    assert.equal(readerAi.source, null);

    const ownerAiResponse = await request(
      "/api/ai/session",
      "xiangk123@gmail.com",
    );
    assert.equal(ownerAiResponse.status, 200);
    const ownerAi = await ownerAiResponse.json();
    assert.equal(ownerAi.connected, true);
    assert.equal(ownerAi.source, "shared");

    const readerResearchResponse = await request(
      "/api/arxiv/session",
      "reader@example.com",
    );
    assert.equal(readerResearchResponse.status, 200);
    const readerResearch = await readerResearchResponse.json();
    assert.deepEqual(readerResearch.arxiv, {
      keyRequired: false,
      source: "public",
    });
    assert.equal(readerResearch.semanticScholar.keyConnected, false);
    assert.equal(readerResearch.semanticScholar.source, "public");

    const managerResearchResponse = await request(
      "/api/arxiv/session",
      "xumiaojun49@gmail.com",
    );
    assert.equal(managerResearchResponse.status, 200);
    const managerResearch = await managerResearchResponse.json();
    assert.equal(managerResearch.semanticScholar.keyConnected, true);
    assert.equal(managerResearch.semanticScholar.source, "shared");
  } finally {
    delete process.env.OPENAI_API_KEY;
    delete process.env.SEMANTIC_SCHOLAR_API_KEY;
  }
});

test("advanced arXiv search forwards safe structure and returns Atom pagination metadata", async () => {
  let upstreamUrl = null;
  await withMockedFetch(async (input) => {
    upstreamUrl = new URL(
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url,
    );
    return new Response(atomFeed([
      { id: "2607.00002", title: "Second upstream result" },
      { id: "2607.00001", title: "First upstream result" },
    ], { total: 43, start: 20, limit: 2 }), {
      headers: { "content-type": "application/atom+xml" },
    });
  }, async () => {
    const response = await request(
      "/api/arxiv?q=world+model&field=title&match=phrase&exclude=survey&category=cs.RO&fromYear=2025&toYear=2026&start=20&limit=2",
    );
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    const data = await response.json();
    assert.deepEqual(data.papers.map((paper) => paper.id), [
      "2607.00002",
      "2607.00001",
    ]);
    assert.deepEqual(data.meta, {
      mode: "search",
      totalResults: 43,
      start: 20,
      limit: 2,
      itemsPerPage: 2,
      hasPrevious: true,
      hasNext: true,
      sort: "relevance",
      order: "descending",
      field: "title",
      match: "phrase",
    });
  });
  assert.equal(upstreamUrl.origin, "https://export.arxiv.org");
  assert.equal(upstreamUrl.searchParams.get("sortBy"), "relevance");
  assert.equal(upstreamUrl.searchParams.get("start"), "20");
  assert.equal(upstreamUrl.searchParams.get("max_results"), "2");
  assert.match(upstreamUrl.searchParams.get("search_query"), /ti:"world model"/);
  assert.match(upstreamUrl.searchParams.get("search_query"), /ANDNOT/);
  assert.match(upstreamUrl.searchParams.get("search_query"), /cat:cs\.RO/);
});

test("feed returns a generic public candidate pool without consuming personal query data", async () => {
  const calls = [];
  const entries = Array.from({ length: 12 }, (_, index) => ({
    id: `2607.${String(index + 1).padStart(5, "0")}`,
    title: `Generic robot candidate ${index + 1}`,
    category: index % 2 ? "cs.CV" : "cs.RO",
  }));
  await withMockedFetch(async (input, init = {}) => {
    const url = new URL(
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url,
    );
    calls.push({ url, init });
    if (url.hostname === "export.arxiv.org") {
      return new Response(atomFeed(entries, { total: 12, limit: 60 }));
    }
    if (url.hostname === "api.semanticscholar.org") {
      const ids = JSON.parse(init.body).ids;
      return Response.json(ids.map((id, index) => ({
        externalIds: { ArXiv: id.replace(/^ARXIV:/, "") },
        citationCount: index + 1,
        influentialCitationCount: index % 3,
      })));
    }
    throw new Error(`Unexpected upstream: ${url}`);
  }, async () => {
    const response = await request(
      "/api/arxiv?mode=feed&interests=PRIVATE_TOPIC&profile=PRIVATE_SIGNAL&feedback=PRIVATE_FEEDBACK",
    );
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    const data = await response.json();
    assert.equal(data.papers.length, 12);
    assert.equal(new Set(data.papers.map((paper) => paper.id)).size, 12);
    assert.equal(data.source, "arxiv+semantic-scholar");
    assert.deepEqual(data.meta, {
      mode: "feed",
      rankingVersion: "orbit-v3-local",
      candidateCount: 12,
      dailyLimit: 10,
      metadataCredential: "public",
      personalization: "client",
      signals: [
        "interest",
        "local-affinity",
        "explicit-feedback",
        "freshness",
        "influence",
        "evidence",
        "diversity",
      ],
    });
  });
  assert.equal(calls.filter((call) => call.url.hostname === "export.arxiv.org").length, 1);
  assert.equal(calls.filter((call) => call.url.hostname === "api.semanticscholar.org").length, 1);
  const semanticCall = calls.find(
    (call) => call.url.hostname === "api.semanticscholar.org",
  );
  assert.equal(new Headers(semanticCall.init.headers).get("x-api-key"), null);
  const arxivUrl = calls.find((call) => call.url.hostname === "export.arxiv.org").url;
  assert.equal(arxivUrl.searchParams.get("max_results"), "60");
  assert.equal(arxivUrl.searchParams.get("sortBy"), "submittedDate");
  assert.doesNotMatch(arxivUrl.href, /PRIVATE_TOPIC|PRIVATE_SIGNAL|PRIVATE_FEEDBACK/);
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
  assert.equal(report.source, "abstract-preview");
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

test("connects a private OpenAI session and sends only the validated arXiv PDF", async () => {
  const apiKey = "sk-test-paper-orbit-private-session-key";
  const readerEmail = "reader@example.com";
  const upstreamCalls = [];

  await withMockedFetch(async (input, init = {}) => {
    const url = typeof input === "string" ? input : input.url;
    upstreamCalls.push({ url, init });
    if (url === "https://api.openai.com/v1/models") {
      assert.equal(new Headers(init.headers).get("authorization"), `Bearer ${apiKey}`);
      return Response.json({ data: [{ id: "gpt-5.6" }] });
    }
    if (url === "https://api.openai.com/v1/responses") {
      assert.equal(new Headers(init.headers).get("authorization"), `Bearer ${apiKey}`);
      return Response.json({
        output_text:
          "论文的核心机制由三个阶段构成：先编码观测，再用联合目标学习动态表示，最后在推理阶段产生动作。正文证据需要结合方法节、实验节和对应图表核验；这里的测试回答用于确认 PDF 全文链路已经生效。",
        usage: {
          input_tokens: 1234,
          output_tokens: 87,
          total_tokens: 1321,
        },
      });
    }
    throw new Error(`Unexpected upstream request: ${url}`);
  }, async () => {
    const connectResponse = await request("/api/ai/session", readerEmail, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ apiKey }),
    });
    assert.equal(connectResponse.status, 200);
    const connect = await connectResponse.json();
    assert.equal(connect.connected, true);
    assert.equal(connect.source, "session");
    assert.equal(connect.model, "gpt-5.6");
    assert.doesNotMatch(JSON.stringify(connect), /sk-test/);

    const setCookie = connectResponse.headers.get("set-cookie") ?? "";
    assert.match(setCookie, /^paper_orbit_openai_session=v1\./);
    assert.match(setCookie, /Path=\/api\/ai/);
    assert.match(setCookie, /HttpOnly/);
    assert.match(setCookie, /SameSite=Strict/);
    assert.match(setCookie, /Secure/);
    assert.doesNotMatch(setCookie, /sk-test/);
    const cookie = setCookie.split(";")[0];

    const statusResponse = await request("/api/ai/session", readerEmail, {
      headers: { cookie },
    });
    assert.equal(statusResponse.status, 200);
    const status = await statusResponse.json();
    assert.deepEqual(status, {
      connected: true,
      source: "session",
      baseUrl: "https://api.openai.com/v1",
      model: "gpt-5.6",
      sessionAvailable: true,
    });
    assert.doesNotMatch(JSON.stringify(status), /sk-test/);

    const otherAccountResponse = await request(
      "/api/ai/session",
      "xumiaojun49@gmail.com",
      { headers: { cookie } },
    );
    assert.equal(otherAccountResponse.status, 200);
    const otherAccountStatus = await otherAccountResponse.json();
    assert.equal(otherAccountStatus.connected, false);
    assert.equal(otherAccountStatus.source, null);

    const paper = {
      id: "2607.00001",
      title: "A Full Text Test Paper",
      authors: ["Researcher One"],
      summary: "A short abstract used only as supplemental metadata.",
      category: "cs.RO",
      tags: ["Physical AI"],
    };
    const aiResponse = await request("/api/ai", readerEmail, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({
        paper,
        action: "chat",
        prompt: "请解释图表中的核心机制。",
        history: [{ role: "user", text: "先概括研究问题。" }],
      }),
    });
    assert.equal(aiResponse.status, 200);
    const answer = await aiResponse.json();
    assert.equal(answer.mode, "openai");
    assert.equal(answer.source, "fulltext-pdf");
    assert.equal(answer.credentialSource, "session");
    assert.equal(answer.pdfDetail, "high");
    assert.deepEqual(answer.usage, {
      inputTokens: 1234,
      outputTokens: 87,
      totalTokens: 1321,
    });

    const responsesCall = upstreamCalls.find(
      (call) => call.url === "https://api.openai.com/v1/responses",
    );
    assert.ok(responsesCall);
    const payload = JSON.parse(responsesCall.init.body);
    assert.equal(payload.model, "gpt-5.6");
    assert.equal(payload.store, false);
    assert.equal(payload.input[0].content[0].type, "input_file");
    assert.equal(
      payload.input[0].content[0].file_url,
      "https://arxiv.org/pdf/2607.00001",
    );
    assert.equal(payload.input[0].content[0].detail, "high");
    assert.equal(payload.input[0].content[1].type, "input_text");
    assert.match(payload.input[0].content[1].text, /先概括研究问题/);

    const invalidResponse = await request("/api/ai", readerEmail, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({
        paper: { ...paper, id: "https://evil.example/private.pdf" },
        action: "chat",
        prompt: "Read this file",
      }),
    });
    assert.equal(invalidResponse.status, 400);
    const invalid = await invalidResponse.json();
    assert.equal(invalid.code, "ARXIV_ID_REQUIRED");

    const disconnectResponse = await request("/api/ai/session", readerEmail, {
      method: "DELETE",
      headers: { cookie },
    });
    assert.equal(disconnectResponse.status, 200);
    assert.match(disconnectResponse.headers.get("set-cookie") ?? "", /Max-Age=0/);
  });
});

test("uses a reader-owned OpenAI-compatible Base URL, short key, and custom model", async () => {
  const apiKey = "alt-key";
  const readerEmail = "compatible-reader@example.com";
  const submittedBaseUrl = "https://gateway.paperorbit.ai/openai/v1/";
  const baseUrl = "https://gateway.paperorbit.ai/openai/v1";
  const model = "vendor/research-model@2026";
  const upstreamCalls = [];

  await withMockedFetch(async (input, init = {}) => {
    const url = typeof input === "string" ? input : input.url;
    upstreamCalls.push({ url, init });
    assert.equal(new Headers(init.headers).get("authorization"), `Bearer ${apiKey}`);
    assert.equal(init.redirect, "error");

    if (url === `${baseUrl}/models`) {
      return Response.json({ data: [{ id: model, object: "model" }] });
    }
    if (url === `${baseUrl}/responses`) {
      return Response.json({
        output_text:
          "这篇论文首先定义研究问题，再由核心表征模块提取状态，随后通过训练目标约束动态变化，最后在实验中验证主要组件。回答来自自定义兼容服务，用于确认端点、模型和全文输入均按个人会话隔离。",
        usage: {
          input_tokens: 321,
          output_tokens: 54,
          total_tokens: 375,
        },
      });
    }
    throw new Error(`Unexpected upstream request: ${url}`);
  }, async () => {
    const connectResponse = await request("/api/ai/session", readerEmail, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ apiKey, baseUrl: submittedBaseUrl, model }),
    });
    assert.equal(connectResponse.status, 200);
    const connect = await connectResponse.json();
    assert.deepEqual(connect, {
      connected: true,
      source: "session",
      baseUrl,
      model,
      sessionAvailable: true,
    });
    assert.doesNotMatch(JSON.stringify(connect), /alt-key/);

    const setCookie = connectResponse.headers.get("set-cookie") ?? "";
    assert.match(setCookie, /^paper_orbit_openai_session=v1\./);
    assert.ok(setCookie.length < 4096);
    assert.doesNotMatch(setCookie, /alt-key|gateway\.paperorbit|research-model/);
    const cookie = setCookie.split(";")[0];

    const statusResponse = await request("/api/ai/session", readerEmail, {
      headers: { cookie },
    });
    assert.equal(statusResponse.status, 200);
    assert.deepEqual(await statusResponse.json(), {
      connected: true,
      source: "session",
      baseUrl,
      model,
      sessionAvailable: true,
    });

    const aiResponse = await request("/api/ai", readerEmail, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({
        paper: {
          id: "2607.00002",
          title: "Compatible Provider Test Paper",
          authors: ["Researcher Two"],
          summary: "A short metadata summary.",
          category: "cs.AI",
          tags: ["Reasoning"],
        },
        action: "chat",
        prompt: "请解释这篇论文的核心机制。",
      }),
    });
    assert.equal(aiResponse.status, 200);
    const answer = await aiResponse.json();
    assert.equal(answer.mode, "openai");
    assert.equal(answer.provider, "compatible");
    assert.equal(answer.model, model);
    assert.equal(answer.credentialSource, "session");

    const responsesCall = upstreamCalls.find(
      (call) => call.url === `${baseUrl}/responses`,
    );
    assert.ok(responsesCall);
    const payload = JSON.parse(responsesCall.init.body);
    assert.equal(payload.model, model);
    assert.equal(payload.input[0].content[0].type, "input_file");
    assert.equal(
      payload.input[0].content[0].file_url,
      "https://arxiv.org/pdf/2607.00002",
    );
  });
});

test("rejects unsafe custom AI endpoints before sending a credential", async () => {
  const unsafeBaseUrls = [
    "http://gateway.paperorbit.ai/v1",
    "https://localhost/v1",
    "https://service.local/v1",
    "https://127.0.0.1/v1",
    "https://2130706433/v1",
    "https://169.254.169.254/v1",
    "https://[::1]/v1",
    "https://metadata.google.internal/v1",
    "https://user:password@gateway.paperorbit.ai/v1",
    "https://gateway.paperorbit.ai:8443/v1",
    "https://gateway.paperorbit.ai/v1?tenant=private",
    "https://gateway.paperorbit.ai/v1#responses",
  ];
  let fetchCalls = 0;

  await withMockedFetch(async () => {
    fetchCalls += 1;
    throw new Error("Unsafe endpoint must not be fetched");
  }, async () => {
    for (const baseUrl of unsafeBaseUrls) {
      const response = await request(
        "/api/ai/session",
        "unsafe-endpoint-reader@example.com",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            apiKey: "x",
            baseUrl,
            model: "research-model",
          }),
        },
      );
      assert.equal(response.status, 400, baseUrl);
      const payload = await response.json();
      assert.equal(payload.code, "OPENAI_BASE_URL_INVALID", baseUrl);
    }
  });

  assert.equal(fetchCalls, 0);
});

test("connects a reader-owned Semantic Scholar key for influence enrichment", async () => {
  const apiKey = "semantic-scholar-test-private-reader-key";
  const readerEmail = "reader@example.com";
  const upstreamCalls = [];
  const entries = [
    { id: "2607.00001", title: "Reader-owned influence paper" },
  ];

  await withMockedFetch(async (input, init = {}) => {
    const url = new URL(
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url,
    );
    upstreamCalls.push({ url, init });

    if (
      url.hostname === "api.semanticscholar.org"
      && url.pathname.includes("/paper/ARXIV:1706.03762")
    ) {
      assert.equal(new Headers(init.headers).get("x-api-key"), apiKey);
      return Response.json({ paperId: "204e3073870fae3d05bcbc2f6a8e263d9b72e776" });
    }
    if (url.hostname === "export.arxiv.org") {
      return new Response(atomFeed(entries, { total: 1, limit: 60 }), {
        headers: { "content-type": "application/atom+xml" },
      });
    }
    if (
      url.hostname === "api.semanticscholar.org"
      && url.pathname.endsWith("/paper/batch")
    ) {
      assert.equal(new Headers(init.headers).get("x-api-key"), apiKey);
      return Response.json([
        {
          externalIds: { ArXiv: "2607.00001" },
          citationCount: 12,
          influentialCitationCount: 3,
        },
      ]);
    }
    throw new Error(`Unexpected upstream request: ${url}`);
  }, async () => {
    const connectResponse = await request(
      "/api/arxiv/session",
      readerEmail,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ apiKey }),
      },
    );
    assert.equal(connectResponse.status, 200);
    const connect = await connectResponse.json();
    assert.deepEqual(connect.arxiv, {
      keyRequired: false,
      source: "public",
    });
    assert.equal(connect.semanticScholar.keyConnected, true);
    assert.equal(connect.semanticScholar.source, "session");
    assert.doesNotMatch(JSON.stringify(connect), /private-reader-key/);

    const setCookie = connectResponse.headers.get("set-cookie") ?? "";
    assert.match(
      setCookie,
      /^paper_orbit_semantic_scholar_session=v1\./,
    );
    assert.match(setCookie, /Path=\/api\/arxiv/);
    assert.match(setCookie, /HttpOnly/);
    assert.match(setCookie, /SameSite=Strict/);
    assert.match(setCookie, /Secure/);
    assert.doesNotMatch(setCookie, /private-reader-key/);
    const cookie = setCookie.split(";")[0];

    const statusResponse = await request(
      "/api/arxiv/session",
      readerEmail,
      { headers: { cookie } },
    );
    assert.equal(statusResponse.status, 200);
    const status = await statusResponse.json();
    assert.equal(status.semanticScholar.keyConnected, true);
    assert.equal(status.semanticScholar.source, "session");

    const otherAccountResponse = await request(
      "/api/arxiv/session",
      "other-reader@example.com",
      { headers: { cookie } },
    );
    assert.equal(otherAccountResponse.status, 200);
    const otherAccount = await otherAccountResponse.json();
    assert.equal(otherAccount.semanticScholar.keyConnected, false);
    assert.equal(otherAccount.semanticScholar.source, "public");

    const feedResponse = await request(
      "/api/arxiv?mode=feed",
      readerEmail,
      { headers: { cookie } },
    );
    assert.equal(feedResponse.status, 200);
    const feed = await feedResponse.json();
    assert.equal(feed.meta.metadataCredential, "session");
    assert.equal(feed.source, "arxiv+semantic-scholar");
    assert.equal(feed.papers[0].recommendation.citationCount, 12);

    const disconnectResponse = await request(
      "/api/arxiv/session",
      readerEmail,
      { method: "DELETE", headers: { cookie } },
    );
    assert.equal(disconnectResponse.status, 200);
    const disconnect = await disconnectResponse.json();
    assert.equal(disconnect.semanticScholar.source, "public");
    assert.match(
      disconnectResponse.headers.get("set-cookie") ?? "",
      /Max-Age=0/,
    );
  });

  assert.ok(
    upstreamCalls.some(
      (call) => call.url.pathname.endsWith("/paper/batch"),
    ),
  );
});

test("ships ten fallback papers and the local-first recommendation pipeline", async () => {
  const [page, client, localUserStorage, access, route, searchQuery, researchSession, researchSessionRoute, aiRoute, encryptedSession, aiSession, sessionRoute, providerConfig, recommendation, layout, readme, envExample, hosting] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/paper-orbit-client.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/local-user-storage.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/access-control.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/arxiv/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/arxiv/search-query.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/arxiv/research-session.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/arxiv/session/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/ai/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/encrypted-session.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/ai/openai-session.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/ai/session/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/ai/provider-config.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/arxiv/recommendation.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../README.md", import.meta.url), "utf8"),
    readFile(new URL("../.env.example", import.meta.url), "utf8"),
    readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"),
  ]);

  assert.match(client, /const DAILY_PAPER_COUNT = 10/);
  assert.equal((client.match(/id: "2607\./g) ?? []).length, 10);
  assert.match(localUserStorage, /paper-orbit:user:\$\{scope\}/);
  assert.match(localUserStorage, /paper-orbit:legacy-storage-claim-v1/);
  assert.match(localUserStorage, /if \(!canClaim\) return false/);
  assert.match(client, /viewer\.role !== "reader"/);
  assert.match(recommendation, /paper-orbit:affinity-v3/);
  assert.match(recommendation, /paper-orbit:affinity-v2/);
  assert.match(recommendation, /paper-orbit:paper-feedback-v1/);
  assert.match(page, /requireChatGPTUser/);
  assert.match(access, /xiangk123@gmail\.com/);
  assert.match(access, /xumiaojun49@gmail\.com/);
  assert.match(access, /role: access\?\.role \?\? "reader"/);
  assert.doesNotMatch(access, /not authorized for Paper Orbit/);
  assert.match(route, /paperOrbitApiAccessError/);
  assert.match(route, /max_results", "60"/);
  assert.match(route, /api\.semanticscholar\.org\/graph\/v1\/paper\/batch/);
  assert.match(route, /dailyLimit: 10/);
  assert.match(route, /rankingVersion: "orbit-v3-local"/);
  assert.match(route, /metadataCredential/);
  assert.match(route, /personalization: "client"/);
  assert.match(route, /"Cache-Control": "private, no-store"/);
  assert.doesNotMatch(
    route,
    /searchParams\.get\("(?:interests|profile|affinity|feedback|saved|read|reports)"\)/,
  );
  assert.match(client, /fetch\("\/api\/arxiv\?mode=feed"/);
  assert.match(client, /rankPapersLocally/);
  assert.match(client, /recommendation\.signals\.relevance/);
  assert.match(client, /为什么推荐/);
  assert.match(client, /精确短语/);
  assert.match(client, /上一页/);
  assert.match(client, /wasSaved \? -0\.6 : 1/);
  assert.match(client, /learnFromPaper\(paper, 1\.5\)/);
  assert.match(client, /learnFromPaper\(paper, 2\)/);
  assert.doesNotMatch(client, /Math\.random/);
  assert.match(searchQuery, /title: "ti"/);
  assert.match(searchQuery, /author: "au"/);
  assert.match(searchQuery, /abstract: "abs"/);
  assert.match(aiRoute, /不得连续复用来源中十二个或更多英文单词/);
  assert.match(aiRoute, /violatesOutputPolicy/);
  assert.match(aiRoute, /repairInstructions/);
  assert.match(aiRoute, /type: "input_file"/);
  assert.match(aiRoute, /file_url: pdfUrl/);
  assert.match(aiRoute, /https:\/\/arxiv\.org\/pdf\//);
  assert.match(aiRoute, /fulltext-pdf/);
  assert.match(encryptedSession, /AES-GCM/);
  assert.match(encryptedSession, /HttpOnly/);
  assert.match(encryptedSession, /SameSite=Strict/);
  assert.match(aiSession, /isPaperOrbitPrivilegedEmail/);
  assert.match(sessionRoute, /openAIProviderEndpoint\(baseUrl, "models"\)/);
  assert.match(sessionRoute, /redirect: "error"/);
  assert.match(aiRoute, /openAIProviderEndpoint\(credential\.baseUrl, "responses"\)/);
  assert.match(providerConfig, /https:\/\/api\.openai\.com\/v1/);
  assert.match(providerConfig, /normalizeOpenAIBaseUrl/);
  assert.match(providerConfig, /169 && second === 254/);
  assert.match(providerConfig, /normalized\.includes\(":"\)/);
  assert.match(researchSession, /isPaperOrbitPrivilegedEmail/);
  assert.match(researchSessionRoute, /api\.semanticscholar\.org/);
  assert.match(researchSessionRoute, /x-api-key/);
  assert.match(client, /连接你的研究服务/);
  assert.match(client, /OpenAI 兼容 API/);
  assert.match(client, /API Base URL/);
  assert.match(client, /不限 sk- 前缀/);
  assert.match(client, /arXiv 公开 API/);
  assert.match(client, /Semantic Scholar API Key/);
  assert.match(client, /PDF 全文/);
  assert.match(readme, /Responses `\/responses`/);
  assert.match(readme, /Orbit v3 Local/);
  assert.match(readme, /90 天半衰期/);
  assert.match(envExample, /PAPER_ORBIT_SESSION_SECRET=/);
  assert.deepEqual(JSON.parse(hosting), {
    project_id: "appgprj_6a54adc87188819197397fa1dc842363",
  });
  assert.match(recommendation, /relevance: 0\.42/);
  assert.match(recommendation, /similarity: 0\.16/);
  assert.match(recommendation, /rankPapersLocally/);
  assert.doesNotMatch(recommendation, /Math\.random/);
  assert.match(layout, /Paper Orbit/);
  assert.doesNotMatch(client, /_sites-preview|SkeletonPreview/);
});
