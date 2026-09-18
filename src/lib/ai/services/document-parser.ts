import { createHash } from "node:crypto";
import type { SourceType } from "../schema/types";

export const TEXT_MIME = new Set(["text/plain", "text/markdown", "text/csv"]);
export const SUPPORTED_UPLOAD_TYPES = new Set([
  "text/plain",
  "text/markdown",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/msword",
  "application/vnd.ms-excel",
  "application/vnd.ms-excel.sheet.macroEnabled.12",
]);

export type ParsedSource = {
  sourceType: SourceType;
  fileName: string | null;
  mimeType: string | null;
  contentText: string;
  contentHash: string;
  byteSize: number;
  parseStatus: "extracted" | "unsupported_binary" | "failed";
  parseMessage: string | null;
};

export function hashContent(content: string) {
  return createHash("sha256").update(content).digest("hex");
}

/**
 * 一期文档解析：文本直接入库；xlsx/docx/pdf 仅登记元数据。
 * 表格单元格定位、分页抽取等详细 Parser 规格尚未冻结，不在此层猜测。
 */
export function parseSourceInput(input: {
  sourceType: SourceType;
  fileName?: string | null;
  mimeType?: string | null;
  text?: string | null;
}): ParsedSource {
  const text = (input.text ?? "").trim();
  const mime = input.mimeType || (input.fileName?.endsWith(".txt") ? "text/plain" : null);
  const isBinaryName = Boolean(input.fileName && /\.(pdf|docx?|xlsx?)$/i.test(input.fileName));
  if (text) {
    return {
      sourceType: input.sourceType,
      fileName: input.fileName ?? null,
      mimeType: mime,
      contentText: text,
      contentHash: hashContent(text),
      byteSize: Buffer.byteLength(text, "utf8"),
      parseStatus: "extracted",
      parseMessage: null,
    };
  }
  if (isBinaryName) {
    const name = input.fileName || "未命名文件";
    return {
      sourceType: input.sourceType,
      fileName: name,
      mimeType: mime,
      contentText: "",
      contentHash: hashContent(`${name}:${mime ?? ""}`),
      byteSize: 0,
      parseStatus: "unsupported_binary",
      parseMessage: "该格式的正文/表格抽取规格尚未冻结。请同时粘贴关键文本，或等待后续 Parser 接入。",
    };
  }
  throw new Error("请粘贴文本，或上传带正文的资料");
}
