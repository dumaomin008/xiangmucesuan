"use client";

import { useState } from "react";
import { Button, Card, TextArea } from "@/components/ui";
import { AI_ASSISTANT_SHORTCUTS } from "@/lib/ai/tools";

export function AssistantDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [question, setQuestion] = useState("");
  const [reply, setReply] = useState("");

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/20" onClick={onClose}>
      <aside
        className="h-full w-full max-w-md overflow-y-auto border-l border-white/50 bg-white/72 p-6 shadow-sn-float backdrop-blur-[20px] saturate-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-[22px] font-semibold">AI 助手</h2>
            <p className="mt-1 text-[13px] text-sn-secondary">默认带入当前测算版本。对话执行与 Prompt 规格尚未冻结。</p>
          </div>
          <button className="text-sn-secondary" onClick={onClose}>
            关闭
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {AI_ASSISTANT_SHORTCUTS.map((item) => (
            <button
              key={item}
              className="rounded-full bg-white px-3 py-1.5 text-left text-[12px] text-sn-secondary shadow-sn-card"
              onClick={() => setQuestion(item)}
            >
              {item}
            </button>
          ))}
        </div>
        <div className="mt-4">
          <TextArea rows={4} value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="例如：如果运价下降 5% 会怎样？" />
        </div>
        <Button
          className="mt-3 w-full"
          onClick={() =>
            setReply(
              "这类问题需要创建临时场景并调用测算引擎，不能由模型直接改数字。Tool Calling 与 Prompt 规格补齐后，会基于当前正式版本重算并展示与基准方案的差异。",
            )
          }
        >
          发送
        </Button>
        {reply && (
          <Card className="mt-4">
            <p className="text-[14px] leading-6 text-sn-secondary">{reply}</p>
          </Card>
        )}
      </aside>
    </div>
  );
}
