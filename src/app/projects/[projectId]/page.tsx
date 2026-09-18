"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Card, PageHeader } from "@/components/ui";
import { PageCanvas } from "@/components/shell/app-shell";
import { api } from "@/lib/client";
import { formatDateTime } from "@/lib/format";

type Project = {
  projectName: string;
  projectCode: string;
  customerName: string;
  projectManager: string;
  projectStatus: string;
  startDate: string | null;
  endDate: string | null;
};

export default function OverviewPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [project, setProject] = useState<Project | null>(null);
  useEffect(() => {
    api<Project>(`/api/projects/${projectId}`).then(setProject);
  }, [projectId]);
  if (!project) return null;
  return (
    <PageCanvas>
      <PageHeader title={project.projectName} subtitle="项目主数据来自项目管理系统，测算模块只引用、不重复建设。" />
      <div className="grid gap-5 md:grid-cols-3">
        <Card>
          <div className="text-[13px] text-sn-muted">项目编号</div>
          <div className="mt-2 text-[22px] font-semibold">{project.projectCode}</div>
        </Card>
        <Card>
          <div className="text-[13px] text-sn-muted">客户</div>
          <div className="mt-2 text-[22px] font-semibold">{project.customerName}</div>
        </Card>
        <Card>
          <div className="text-[13px] text-sn-muted">项目经理</div>
          <div className="mt-2 text-[22px] font-semibold">{project.projectManager}</div>
        </Card>
        <Card>
          <div className="text-[13px] text-sn-muted">项目状态</div>
          <div className="mt-2 text-[22px] font-semibold">{project.projectStatus}</div>
        </Card>
        <Card>
          <div className="text-[13px] text-sn-muted">计划开始</div>
          <div className="mt-2 text-[22px] font-semibold">{formatDateTime(project.startDate)}</div>
        </Card>
        <Card>
          <div className="text-[13px] text-sn-muted">计划结束</div>
          <div className="mt-2 text-[22px] font-semibold">{formatDateTime(project.endDate)}</div>
        </Card>
      </div>
    </PageCanvas>
  );
}
