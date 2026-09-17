"use client";

import { useParams } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { ProjectTabs } from "@/components/nav";

export default function ProjectLayout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ projectId: string }>();
  return (
    <div>
      <AppHeader />
      <main className="mx-auto max-w-[1280px] px-6 py-8">
        <ProjectTabs projectId={params.projectId} />
        {children}
      </main>
    </div>
  );
}
