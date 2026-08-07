import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  title: "MORI — 现实连接型心理支持桌宠",
  description: "一只帮助用户表达、行动并重新连接现实支持的桌面伙伴。",
  openGraph: {
    title: "MORI — Real-world connection companion",
    description: "Most companions ask you to stay. MORI helps you step away.",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "MORI 与信箱、求助背包站在亮灯的山前" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "MORI — Real-world connection companion",
    description: "Most companions ask you to stay. MORI helps you step away.",
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
