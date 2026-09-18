"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import {
  Calculator,
  FolderOpen,
  GitCompare,
  HelpCircle,
  LayoutDashboard,
  PanelLeftClose,
  PanelLeftOpen,
  SlidersHorizontal,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { ROLE_LABEL, canManageRules, type DemoRole } from "@/lib/auth";
import { ModeProvider, useCalcMode } from "@/lib/workspace/mode";

function projectIdFromPath(pathname: string) {
  const match = pathname.match(/^\/projects\/([^/]+)/);
  const id = match?.[1];
  if (!id || id === "new") return null;
  return id;
}

function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const pathname = usePathname();
  const projectId = projectIdFromPath(pathname);
  const [role, setRole] = useState<DemoRole>("MANAGER");
  const [user, setUser] = useState("王经理");

  useEffect(() => {
    setRole((localStorage.getItem("demo-role") as DemoRole) || "MANAGER");
    setUser(localStorage.getItem("demo-user") || "王经理");
  }, []);

  const items = [
    { href: "/", label: "工作台", icon: LayoutDashboard, match: (p: string) => p === "/" },
    {
      href: projectId ? `/projects/${projectId}/calculation` : "/",
      label: "项目测算",
      icon: Calculator,
      match: (p: string) => p.includes("/calculation") && !p.includes("/compare"),
    },
    {
      href: projectId ? `/projects/${projectId}/calculation/compare` : "/projects",
      label: "方案对比",
      icon: GitCompare,
      match: (p: string) => p.includes("/compare"),
    },
    { href: "/projects", label: "历史项目", icon: FolderOpen, match: (p: string) => p === "/projects" },
  ];
  if (canManageRules(role)) {
    items.push({
      href: "/admin/parameters",
      label: "测算模型",
      icon: SlidersHorizontal,
      match: (p: string) => p.startsWith("/admin"),
    });
  }

  return (
    <aside
      className={clsx(
        "sticky top-0 flex h-screen flex-col border-r border-black/[0.06] bg-white transition-[width] duration-200",
        collapsed ? "w-[72px]" : "w-[224px]",
      )}
    >
      <div className={clsx("flex items-center gap-3 px-4 py-5", collapsed && "justify-center px-2")}>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sn-sm bg-sn-primary text-sm font-bold text-white">
          测
        </div>
        {!collapsed && (
          <div>
            <div className="text-[14px] font-semibold">智能测算工作台</div>
            <div className="text-[11px] text-sn-muted">确定性引擎 · AI 辅助</div>
          </div>
        )}
      </div>
      <nav className="flex-1 space-y-1 px-3">
        {items.map((item) => {
          const active = item.match(pathname);
          const Icon = item.icon;
          return (
            <Link
              key={item.label}
              href={item.href}
              className={clsx(
                "flex items-center gap-3 rounded-sn-sm px-3 py-2.5 text-[14px] font-medium transition duration-200",
                active ? "bg-sn-primary text-white" : "text-sn-secondary hover:bg-sn-hover",
                collapsed && "justify-center px-2",
              )}
            >
              <Icon size={18} />
              {!collapsed && item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-black/[0.06] p-3">
        <Link
          href="/help"
          className={clsx(
            "mb-2 flex items-center gap-3 rounded-sn-sm px-3 py-2 text-[13px] text-sn-secondary hover:bg-sn-hover",
            collapsed && "justify-center px-2",
          )}
        >
          <HelpCircle size={18} />
          {!collapsed && "帮助中心"}
        </Link>
        <div className={clsx("rounded-sn-sm bg-sn-subtle px-3 py-2", collapsed && "px-2 text-center")}>
          {!collapsed && <div className="text-[13px] font-medium text-sn-primary">{user}</div>}
          <select
            value={role}
            onChange={(e) => {
              const next = e.target.value as DemoRole;
              setRole(next);
              localStorage.setItem("demo-role", next);
              window.location.reload();
            }}
            className="mt-1 w-full bg-transparent text-[12px] text-sn-secondary"
            aria-label="当前角色"
          >
            {Object.entries(ROLE_LABEL).map(([code, label]) => (
              <option key={code} value={code}>
                {collapsed ? code : label}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={onToggle}
          className="mt-2 flex w-full items-center justify-center rounded-sn-sm py-2 text-sn-muted hover:bg-sn-hover"
          aria-label={collapsed ? "展开导航" : "收起导航"}
        >
          {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
        </button>
      </div>
    </aside>
  );
}

function ShellInner({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    setCollapsed(localStorage.getItem("nav-collapsed") === "1");
  }, []);
  return (
    <div className="flex min-h-screen bg-sn-page">
      <Sidebar
        collapsed={collapsed}
        onToggle={() => {
          const next = !collapsed;
          setCollapsed(next);
          localStorage.setItem("nav-collapsed", next ? "1" : "0");
        }}
      />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <ModeProvider>
      <ShellInner>{children}</ShellInner>
    </ModeProvider>
  );
}

export function PageCanvas({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return <main className={clsx("mx-auto px-6 py-8", wide ? "max-w-[1440px]" : "max-w-[1200px]")}>{children}</main>;
}

export function CalcModeSwitch() {
  const { professional, setMode } = useCalcMode();
  return (
    <button
      type="button"
      onClick={() => setMode(professional ? "normal" : "pro")}
      className="rounded-full bg-white px-3 py-1.5 text-[12px] font-medium text-sn-secondary shadow-sn-card"
    >
      {professional ? "专业模式" : "普通模式"}
    </button>
  );
}
