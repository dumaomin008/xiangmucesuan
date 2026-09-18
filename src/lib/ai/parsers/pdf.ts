import type { ParsedDocument } from "./types";

export async function parsePdfBuffer(buffer: Buffer, fileName: string): Promise<ParsedDocument> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const result = await parser.getText();
    const text = (result.text || "").trim();
    return {
      sourceId: fileName,
      fileName,
      mimeType: "application/pdf",
      text,
      sections: text ? [{ content: text }] : [],
      warnings: text ? [] : ["该文件可能为扫描件，本次未识别到有效正文，可粘贴关键内容继续演示。"],
    };
  } finally {
    await parser.destroy().catch(() => undefined);
  }
}
