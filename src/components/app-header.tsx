"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ROLE_LABEL, type DemoRole } from "@/lib/auth";
import { clsx } from "clsx";

export function AppHeader() {
  const [role, setRole] = useState<DemoRole>("MANAGER");
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const saved = (localStorage.getItem("demo-role") as DemoRole) || "MANAGER";
    setRole(saved);
  }, []);

  return (
    <header className="sticky top-0 z-30 border-b border-white/50 bg-white/72 backdrop-blur-[20px] saturate-150">
      <div className="mx-auto flex max-w-[1280px] items-center justify-between gap-4 px-6 py-3">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-sn-sm bg-sn-primary text-white text-sm font-bold">
            测
          </div>
          <div>
            <div className="text-[15px] font-semibold">项目经营测算</div>
            <div className="text-[12px] text-sn-muted">项目管理系统模块 Demo</div>
          </div>
        </Link>
        <div className="flex items-center gap-3">
          <Link
            href="/admin/parameters"
            className={clsx(
              "rounded-full px-3 py-1.5 text-[13px] text-sn-secondary hover:bg-sn-hover",
              pathname.startsWith("/admin") && "bg-sn-hover text-sn-primary",
            )}
          >
            参数标准库
          </Link>
          <select
            value={role}
            onChange={(e) => {
              const next = e.target.value as DemoRole;
              setRole(next);
              localStorage.setItem("demo-role", next);
              router.refresh();
            }}
            className="rounded-full border border-black/[0.06] bg-white px-3 py-1.5 text-[13px]"
          >
            {Object.entries(ROLE_LABEL).map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </header>
  );
}
