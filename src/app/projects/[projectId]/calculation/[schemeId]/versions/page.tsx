"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { CalculationSubnav } from "@/components/nav";
import { Card, PageHeader, StatusBadge } from "@/components/ui";
import { api } from "@/lib/client";
import { formatDateTime } from "@/lib/format";

type Version = {
  id: string;
  versionNo: string;
  createdBy: string;
  createdAt: string;
  changeNote: string | null;
  ruleVersion: string;
  calculationStatus: string;
};
type Log = {
  id: string;
  parameterName: string;
  oldValue: string | null;
  newValue: string | null;
  unit: string | null;
  changeReason: string | null;
  changedBy: string;
  changedAt: string;
};

export default function VersionsPage() {
  const { projectId, schemeId } = useParams<{ projectId: string; schemeId: string }>();
  const [versions, setVersions] = useState<Version[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  useEffect(() => {
    api<{ versions: Version[] }>(`/api/calculation-schemes/${schemeId}/versions`).then((d) => setVersions(d.versions));
    api<Log[]>(`/api/calculation-versions/${schemeId}/change-log`).then(setLogs);
  }, [schemeId]);

  return (
    <div>
      <CalculationSubnav projectId={projectId} schemeId={schemeId} />
      <PageHeader title="版本记录" subtitle="历史测算绑定当时的参数快照和规则版本，标准库更新不会改写历史结果。" />
      <Card className="mb-5">
        <h3 className="mb-4 text-[20px] font-semibold">测算版本</h3>
        <div className="space-y-3">
          {versions.map((v) => (
            <div key={v.id} className="flex flex-wrap items-center justify-between gap-3 rounded-sn-md bg-sn-subtle px-4 py-3">
              <div>
                <div className="font-semibold">{v.versionNo}</div>
                <div className="text-[13px] text-sn-secondary">
                  {v.createdBy} · {formatDateTime(v.createdAt)} · 规则 {v.ruleVersion}
                </div>
              </div>
              <StatusBadge status={v.calculationStatus} />
            </div>
          ))}
          {versions.length === 0 && <p className="text-sn-secondary">尚未形成正式测算版本。</p>}
        </div>
      </Card>
      <Card>
        <h3 className="mb-4 text-[20px] font-semibold">参数变更记录</h3>
        <table className="min-w-full text-left text-sm">
          <thead className="text-[12px] text-sn-muted">
            <tr>
              {["参数", "旧值", "新值", "单位", "原因", "修改人", "时间"].map((h) => (
                <th key={h} className="px-3 py-2 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id} className="border-t border-black/[0.04]">
                <td className="px-3 py-2">{l.parameterName}</td>
                <td className="px-3 py-2">{l.oldValue}</td>
                <td className="px-3 py-2">{l.newValue}</td>
                <td className="px-3 py-2">{l.unit}</td>
                <td className="px-3 py-2">{l.changeReason}</td>
                <td className="px-3 py-2">{l.changedBy}</td>
                <td className="px-3 py-2">{formatDateTime(l.changedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
