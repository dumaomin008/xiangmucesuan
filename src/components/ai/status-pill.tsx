import { clsx } from "clsx";

const MAP: Record<string, { label: string; className: string }> = {
  default: { label: "系统默认", className: "bg-black/5 text-sn-secondary" },
  demo_history: { label: "演示参考值", className: "bg-sn-warning/15 text-[#C47B12]" },
  demo_vehicle: { label: "演示参考值", className: "bg-sn-warning/15 text-[#C47B12]" },
  demo: { label: "演示参考值", className: "bg-sn-warning/15 text-[#C47B12]" },
  heuristic: { label: "基础解析", className: "bg-sn-info/12 text-sn-info" },
  llm: { label: "大模型解析", className: "bg-sn-success/12 text-sn-success" },
  empty_scan: { label: "未识别正文", className: "bg-sn-warning/15 text-[#C47B12]" },
  extracted: { label: "已提取", className: "bg-sn-info/12 text-sn-info" },
  reference: { label: "AI参考", className: "bg-sn-warning/15 text-[#C47B12]" },
  missing: { label: "缺失", className: "bg-black/5 text-sn-secondary" },
  conflict: { label: "冲突", className: "bg-sn-error/12 text-sn-error" },
  pending: { label: "待确认", className: "bg-sn-warning/15 text-[#C47B12]" },
  confirmed: { label: "已确认", className: "bg-sn-success/12 text-sn-success" },
  P0: { label: "P0 必须确认", className: "bg-sn-error/12 text-sn-error" },
  P1: { label: "P1 强烈建议", className: "bg-sn-warning/15 text-[#C47B12]" },
  P2: { label: "P2 建议补充", className: "bg-sn-info/12 text-sn-info" },
  collecting: { label: "待解析", className: "bg-sn-info/12 text-sn-info" },
  parsing: { label: "解析中", className: "bg-sn-info/12 text-sn-info" },
  preview: { label: "待确认", className: "bg-sn-warning/15 text-[#C47B12]" },
  draft_saved: { label: "草稿", className: "bg-black/5 text-sn-secondary" },
  calculated: { label: "已测算", className: "bg-sn-success/12 text-sn-success" },
  failed: { label: "解析失败", className: "bg-sn-error/12 text-sn-error" },
  due_diligence: { label: "尽调模板", className: "bg-sn-hover text-sn-secondary" },
  meeting: { label: "会议纪要", className: "bg-sn-hover text-sn-secondary" },
  chat: { label: "聊天内容", className: "bg-sn-hover text-sn-secondary" },
  free_text: { label: "自由文本", className: "bg-sn-hover text-sn-secondary" },
  system: { label: "系统数据", className: "bg-sn-hover text-sn-secondary" },
  system_default: { label: "系统默认值", className: "bg-sn-warning/15 text-[#C47B12]" },
};

export function StatusPill({ value, className }: { value: string; className?: string }) {
  const item = MAP[value] || { label: value, className: "bg-black/5 text-sn-secondary" };
  return (
    <span className={clsx("inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium", item.className, className)}>
      {item.label}
    </span>
  );
}
