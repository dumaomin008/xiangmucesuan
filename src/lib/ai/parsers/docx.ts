import type { ParsedDocument } from "./types";

export async function parseDocxBuffer(buffer: Buffer, fileName: string): Promise<ParsedDocument> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer });
  const text = (result.value || "").trim();
  return {
    sourceId: fileName,
    fileName,
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    text,
    sections: text ? [{ content: text }] : [],
    warnings: text
      ? result.messages.map((m) => m.message)
      : ["该文件可能为扫描件，本次未识别到有效正文，可粘贴关键内容继续演示。"],
  };
}
