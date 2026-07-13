import { paperOrbitApiAccessError } from "../../access-control";

type PaperInput = {
  id?: string;
  title?: string;
  authors?: string[];
  summary?: string;
  zhSummary?: string;
  category?: string;
  tags?: string[];
};

function clean(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function previewAnswer(action: string, paper: PaperInput, prompt: string) {
  const title = clean(paper.title, 300) || "这篇论文";
  const summary = clean(paper.zhSummary || paper.summary, 2400) || "摘要尚未载入。";
  const tags = Array.isArray(paper.tags) ? paper.tags.slice(0, 4).join("、") : "相关方向";

  if (action === "report") {
    return `## 一句话结论\n${title} 的核心价值，是把“${tags}”中的关键问题重新组织为一个可扩展、可验证的学习框架。\n\n## 研究问题\n论文试图解决现有方法在泛化、数据效率与真实环境适配上的共同瓶颈。\n\n## 核心方法\n${summary}\n\n## 你应该关注的贡献\n1. 它改变了问题的建模起点，而不只是替换某个模块。\n2. 训练目标与实际部署条件更一致。\n3. 结果若能跨数据集和硬件复现，影响会超过单一 benchmark 提升。\n\n## 证据与风险\n优先检查消融实验是否隔离了数据规模、预训练骨干和推理预算；其次检查对比方法是否使用同等训练资源。摘要本身不足以确认全部因果结论，正式判断前应阅读实验设置与附录。\n\n## 与你的研究轨道\n这项工作与 ${tags} 直接相关，可作为“表示学习如何转化为可执行物理能力”的案例。\n\n## 三个追问\n- 性能增益主要来自目标设计、数据还是模型规模？\n- 在分布外场景中，失败模式是否仍符合作者的机制解释？\n- 最小可复现实验是什么，能否在一周内证伪核心主张？`;
  }

  const lower = prompt.toLowerCase();
  if (/比较|compare|相关工作/.test(lower)) {
    return `${title} 与常见基线的关键差异，不只是模型规模，而是训练目标是否直接对齐最终任务。建议对照阅读时锁定三列：输入表示、预训练监督和部署时的信息流。当前摘要显示：${summary}`;
  }
  if (/公式|mechanism|机制/.test(lower)) {
    return `先把机制拆成“表示 → 动态预测 → 决策/输出”三层。${summary} 阅读正文时，重点核对每一层的损失函数分别约束了什么，以及推理阶段是否沿用同样的信息结构。`;
  }
  if (/实验|复现|repro/.test(lower)) {
    return `最值得复现的是能隔离核心机制的最小消融：固定数据、骨干和推理预算，只替换作者提出的关键训练目标；再补一个分布外测试。这样比直接追完整榜单更快判断论文主张。`;
  }
  return `这篇论文可以先抓住一个主线：${summary}\n\n针对你的问题“${prompt}”，建议优先检查作者是否用对照实验把“方法本身的贡献”与数据、规模、训练预算区分开。若这一步成立，再看它与 ${tags} 的连接是否能跨任务泛化。`;
}

function extractOutputText(payload: unknown) {
  if (!payload || typeof payload !== "object") return "";
  const data = payload as { output_text?: unknown; output?: unknown };
  if (typeof data.output_text === "string") return data.output_text;
  if (!Array.isArray(data.output)) return "";
  for (const item of data.output) {
    if (!item || typeof item !== "object") continue;
    const content = (item as { content?: unknown }).content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (part && typeof part === "object" && typeof (part as { text?: unknown }).text === "string") {
        return (part as { text: string }).text;
      }
    }
  }
  return "";
}

export async function POST(request: Request) {
  const accessError = await paperOrbitApiAccessError();
  if (accessError) return accessError;

  try {
    const body = (await request.json()) as { paper?: PaperInput; prompt?: unknown; action?: unknown };
    const paper = body.paper ?? {};
    const prompt = clean(body.prompt, 2400);
    const action = clean(body.action, 20) || "chat";
    if (!clean(paper.title, 300) || !prompt) {
      return Response.json({ error: "paper and prompt are required" }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return Response.json({ answer: previewAnswer(action, paper, prompt), mode: "preview" });
    }

    const context = [
      `Title: ${clean(paper.title, 300)}`,
      `arXiv: ${clean(paper.id, 80)}`,
      `Authors: ${Array.isArray(paper.authors) ? paper.authors.slice(0, 12).join(", ") : ""}`,
      `Category: ${clean(paper.category, 80)}`,
      `Abstract: ${clean(paper.summary, 6000)}`,
    ].join("\n");
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-5.2",
        instructions:
          "你是 Paper Orbit 的研究助理。仅基于提供的论文元数据与摘要回答；不确定时明确说明，不虚构实验数字、引用或结论。使用简洁、结构清楚的中文，保留必要英文术语。",
        input: `${context}\n\nTask: ${action}\nUser request: ${prompt}`,
        max_output_tokens: action === "report" ? 1500 : 800,
        store: false,
      }),
    });
    if (!response.ok) throw new Error(`OpenAI returned ${response.status}`);
    const answer = extractOutputText(await response.json());
    if (!answer) throw new Error("OpenAI returned no text");
    return Response.json({ answer, mode: "openai" });
  } catch {
    return Response.json({ error: "AI analysis is temporarily unavailable" }, { status: 502 });
  }
}
