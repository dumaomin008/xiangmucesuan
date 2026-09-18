import type { ConversationMeta } from "./types";

export const CONVERSATION_STORAGE_KEY = "pm-ai-conversations-v1";
export const AI_MODE_STORAGE_KEY = "pm-ai-mode";

export function groupConversations<T extends Pick<ConversationMeta, "updatedAt">>(items: T[], now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const weekAgo = start - 6 * 24 * 60 * 60 * 1000;
  const today: T[] = [];
  const recent: T[] = [];
  const earlier: T[] = [];
  const sorted = [...items].sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  for (const item of sorted) {
    const time = new Date(item.updatedAt).getTime();
    if (!Number.isFinite(time) || time >= start) today.push(item);
    else if (time >= weekAgo) recent.push(item);
    else earlier.push(item);
  }
  return { today, recent, earlier };
}

export function conversationTitle(question: string): string {
  const text = question.replace(/\s+/g, " ").trim();
  if (text.length <= 18) return text || "新对话";
  return `${text.slice(0, 18)}…`;
}
