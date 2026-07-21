import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;
  const title = "Paper Orbit — Daily Paper Reading and AI Research Copilot";
  const description = "Discover 10 high-impact papers tailored to your research interests each day, search arXiv, discuss full PDFs with an AI copilot, and generate structured reading reports.";

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
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
