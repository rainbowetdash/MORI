import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  title: "MORI — 我的桌面陪伴",
  description: "一个帮助你整理感受、记录片刻并连接现实支持的个人桌面伙伴。",
  openGraph: {
    title: "MORI — My quiet desktop companion",
    description: "A small, private corner for reflection and real-world connection.",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "MORI 与信箱、求助背包站在亮灯的山前" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "MORI — My quiet desktop companion",
    description: "A small, private corner for reflection and real-world connection.",
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
