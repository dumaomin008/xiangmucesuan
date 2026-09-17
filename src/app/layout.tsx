import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "项目测算 · 经营测算引擎",
  description: "标准化、可配置、可追溯、可版本化的重卡项目经营测算工具",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className={`${inter.variable} font-sn antialiased text-[#1A1A1E]`}>{children}</body>
    </html>
  );
}
