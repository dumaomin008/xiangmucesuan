"use client";

import { Card, PageHeader } from "@/components/ui";
import { Character } from "@/components/empty";
import { PageCanvas } from "@/components/shell/app-shell";

export default function ProgressPage() {
  return (
    <PageCanvas>
      <PageHeader title="项目进度" subtitle="V1 仅作嵌入占位，后续对接立项与执行。" />
      <Card className="flex items-center gap-8">
        <Character mood="idle" />
        <div>
          <h3 className="text-[22px] font-semibold">进度能力将在测算转立项后接入</h3>
          <p className="mt-2 max-w-xl text-sn-secondary">
            预留链路：基准测算 → 项目立项 → 项目执行 → TMS/车联网回流 → 测算 VS 实际。当前请使用「项目测算」完成经营测算闭环。
          </p>
        </div>
      </Card>
    </PageCanvas>
  );
}
