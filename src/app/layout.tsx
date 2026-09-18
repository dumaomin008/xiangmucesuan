import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "项目测算 · AI智能测算中心",
  description: "AI 尽调解析 + 参数标准化 + 测算辅助 + 决策分析",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className={`${inter.variable} font-sn antialiased text-[#1A1A1E]`}>{children}</body>
    </html>
  );
}
