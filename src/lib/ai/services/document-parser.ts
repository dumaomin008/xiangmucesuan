import { createHash } from "node:crypto";
import { parseDocxBuffer } from "../parsers/docx";
import { parsePdfBuffer } from "../parsers/pdf";
import type { ParsedDocument } from "../parsers/types";
import { parseXlsxBuffer } from "../parsers/xlsx";
import type { SourceType } from "../schema/types";

export type ParsedSource = {
  sourceType: SourceType;
  fileName: string | null;
  mimeType: string | null;
  contentText: string;
  contentHash: string;
  byteSize: number;
  parseStatus: "extracted" | "unsupported_binary" | "failed" | "empty_scan";
  parseMessage: string | null;
  warnings: string[];
};

export function hashContent(content: string) {
  return createHash("sha256").update(content).digest("hex");
}

function fromParsed(sourceType: SourceType, parsed: ParsedDocument, byteSize: number): ParsedSource {
  const empty = !parsed.text.trim();
  return {
    sourceType,
    fileName: parsed.fileName,
    mimeType: parsed.mimeType,
    contentText: parsed.text,
    contentHash: hashContent(parsed.text || parsed.fileName),
    byteSize,
    parseStatus: empty ? "empty_scan" : "extracted",
    parseMessage: empty ? parsed.warnings[0] || "未识别到有效正文，可粘贴关键内容继续演示。" : null,
    warnings: parsed.warnings,
  };
}

export async function parseUploadedFile(input: {
  sourceType: SourceType;
  fileName: string;
  mimeType?: string | null;
  buffer: Buffer;
}): Promise<ParsedSource> {
  const name = input.fileName.toLowerCase();
  try {
    if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
      return fromParsed(input.sourceType, await parseXlsxBuffer(input.buffer, input.fileName), input.buffer.length);
    }
    if (name.endsWith(".docx") || name.endsWith(".doc")) {
      return fromParsed(input.sourceType, await parseDocxBuffer(input.buffer, input.fileName), input.buffer.length);
    }
    if (name.endsWith(".pdf")) {
      return fromParsed(input.sourceType, await parsePdfBuffer(input.buffer, input.fileName), input.buffer.length);
    }
    if (name.endsWith(".txt") || name.endsWith(".md") || (input.mimeType || "").startsWith("text/")) {
      const text = input.buffer.toString("utf8");
      return fromParsed(input.sourceType, {
        sourceId: input.fileName,
        fileName: input.fileName,
        mimeType: input.mimeType || "text/plain",
        text,
        warnings: [],
      }, input.buffer.length);
    }
    return {
      sourceType: input.sourceType,
      fileName: input.fileName,
      mimeType: input.mimeType || null,
      contentText: "",
      contentHash: hashContent(input.fileName),
      byteSize: input.buffer.length,
      parseStatus: "unsupported_binary",
      parseMessage: "暂不支持该文件类型。可粘贴关键内容继续演示。",
      warnings: [],
    };
  } catch (err) {
    return {
      sourceType: input.sourceType,
      fileName: input.fileName,
      mimeType: input.mimeType || null,
      contentText: "",
      contentHash: hashContent(input.fileName),
      byteSize: input.buffer.length,
      parseStatus: "failed",
      parseMessage: err instanceof Error ? err.message : "文件解析失败，可粘贴文本继续。",
      warnings: [],
    };
  }
}

export function parseSourceInput(input: {
  sourceType: SourceType;
  fileName?: string | null;
  mimeType?: string | null;
  text?: string | null;
}): ParsedSource {
  const text = (input.text ?? "").trim();
  if (!text) throw new Error("请粘贴文本，或上传尽调文件");
  return {
    sourceType: input.sourceType,
    fileName: input.fileName ?? null,
    mimeType: input.mimeType || "text/plain",
    contentText: text,
    contentHash: hashContent(text),
    byteSize: Buffer.byteLength(text, "utf8"),
    parseStatus: "extracted",
    parseMessage: null,
    warnings: [],
  };
}
