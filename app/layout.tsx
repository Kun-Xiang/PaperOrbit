import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;
  const title = "Paper Orbit — 每日论文阅读与 AI 研究助手";
  const description = "每天发现与你研究兴趣相关的高价值论文，搜索 arXiv，与 AI 基于 PDF 全文深聊，并自动生成结构化阅读报告。";

  return {
    title,
    description,
    applicationName: "Paper Orbit",
    openGraph: {
      title,
      description,
      type: "website",
      siteName: "Paper Orbit",
      images: [{ url: `${origin}/og.png`, width: 1536, height: 1024, alt: "Paper Orbit daily research edition" }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [`${origin}/og.png`],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
