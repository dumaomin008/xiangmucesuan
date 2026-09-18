"use client";

import { PageCanvas } from "@/components/shell/app-shell";
import { Card, PageHeader } from "@/components/ui";

export default function HelpPage() {
  return (
    <PageCanvas>
      <PageHeader title="帮助中心" subtitle="先把业务情况说清楚，再让计算引擎给出可核对的经营结论。" />
      <div className="grid gap-5 md:grid-cols-2">
        <Card>
          <h3 className="text-[18px] font-semibold">五步测算</h3>
          <p className="mt-2 text-[14px] leading-6 text-sn-secondary">
            基本信息 → 运输场景 → 运营参数 → 成本收益 → 确认测算。常用参数在普通模式，财务税务和线路权重在专业模式。
          </p>
        </Card>
        <Card>
          <h3 className="text-[18px] font-semibold">AI 做什么、不做什么</h3>
          <p className="mt-2 text-[14px] leading-6 text-sn-secondary">
            AI 可以提取资料、提醒缺失和解释结果。车辆数、成本、利润、现金流必须来自计算引擎。AI 建议不会静默改参数。
          </p>
        </Card>
        <Card>
          <h3 className="text-[18px] font-semibold">方案对比</h3>
          <p className="mt-2 text-[14px] leading-6 text-sn-secondary">
            复制当前方案后只改需要变化的参数。对比时打开「只看差异参数」，可以看到结果差在哪里、输入差在哪里。
          </p>
        </Card>
        <Card>
          <h3 className="text-[18px] font-semibold">数字对不上时</h3>
          <p className="mt-2 text-[14px] leading-6 text-sn-secondary">
            点开结果指标可查看计算依据。年收入 = 月营收 × 年运营月数。测算年限不要和年运营月数混用。
          </p>
        </Card>
      </div>
    </PageCanvas>
  );
}
