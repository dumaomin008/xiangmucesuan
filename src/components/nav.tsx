"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";

export function ProjectTabs({ projectId }: { projectId: string }) {
  const pathname = usePathname();
  const tabs = [
    { href: `/projects/${projectId}`, label: "项目概览", match: "overview" },
    { href: `/projects/${projectId}/progress`, label: "项目进度", match: "progress" },
    { href: `/projects/${projectId}/ai`, label: "AI智能测算", match: "ai" },
    { href: `/projects/${projectId}/calculation`, label: "项目测算", match: "calculation" },
  ];
  return (
    <div className="mb-8 flex gap-2 rounded-sn-lg bg-white p-2 shadow-sn-card">
      {tabs.map((tab) => {
        const active =
          tab.match === "overview"
            ? pathname === `/projects/${projectId}`
            : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={clsx(
              "flex-1 rounded-sn-md px-4 py-3 text-center text-[15px] font-semibold transition duration-200",
              active ? "bg-sn-primary text-white" : "text-sn-secondary hover:bg-sn-hover",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}

export function CalculationSubnav({ projectId, schemeId }: { projectId: string; schemeId?: string }) {
  const pathname = usePathname();
  const items = [
    { href: `/projects/${projectId}/calculation`, label: "测算方案" },
    schemeId ? { href: `/projects/${projectId}/calculation/${schemeId}`, label: "参数配置" } : null,
    schemeId ? { href: `/projects/${projectId}/calculation/${schemeId}/results`, label: "测算结果" } : null,
    schemeId ? { href: `/projects/${projectId}/calculation/${schemeId}/cash-flow`, label: "现金流" } : null,
    schemeId ? { href: `/projects/${projectId}/calculation/${schemeId}/sensitivity`, label: "敏感性分析" } : null,
    { href: `/projects/${projectId}/calculation/compare`, label: "方案对比" },
    schemeId ? { href: `/projects/${projectId}/calculation/${schemeId}/versions`, label: "版本记录" } : null,
  ].filter(Boolean) as { href: string; label: string }[];

  return (
    <div className="mb-6 flex flex-wrap gap-2">
      {items.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={clsx(
              "rounded-full px-4 py-2 text-[13px] font-medium transition duration-200",
              active ? "bg-sn-primary text-white" : "bg-white text-sn-secondary shadow-sn-card hover:shadow-sn-hover",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
