import { createId } from "../../utils";
import { unzip } from "./zip-pdf";
import { extensionOf, looksLikeOleXls, looksLikePdf, looksLikeZip } from "./upload-policy";

export type DocumentChunk = {
  id: string;
  fileId: string;
  fileName: string;
  documentType: "excel" | "pdf" | "docx" | "image";
  text: string;
  location?: {
    sheetName?: string;
    cellRange?: string;
    page?: number;
    paragraph?: number;
    table?: number;
  };
};

export type ChunkExtract = {
  ok: boolean;
  chunks: DocumentChunk[];
  errorMessage?: string;
  warnings: string[];
  textLayerMissing?: boolean;
};

function chunk(
  file: { fileId: string; fileName: string },
  documentType: DocumentChunk["documentType"],
  text: string,
  location?: DocumentChunk["location"],
): DocumentChunk {
  return { id: createId("CHK"), fileId: file.fileId, fileName: file.fileName, documentType, text, location };
}

function cellText(value: unknown): { text: string; formula?: string } {
  if (value == null) return { text: "" };
  if (value instanceof Date) return { text: value.toISOString().slice(0, 10) };
  if (typeof value === "object") {
    const rec = value as { formula?: string; result?: unknown; richText?: { text: string }[]; text?: string };
    if (rec.formula) {
      const result = rec.result == null ? "" : cellText(rec.result).text;
      return { text: result, formula: rec.formula };
    }
    if (Array.isArray(rec.richText)) return { text: rec.richText.map((t) => t.text).join("") };
    if (typeof rec.text === "string") return { text: rec.text };
  }
  return { text: String(value) };
}

export async function extractExcelChunks(file: { fileId: string; fileName: string }, bytes: Uint8Array): Promise<ChunkExtract> {
  if (extensionOf(file.fileName) === ".xls" && looksLikeOleXls(bytes)) {
    return { ok: false, chunks: [], warnings: [], errorMessage: "旧版 xls 未解析，请另存为 xlsx。该文件失败不影响其他文件。" };
  }
  if (!looksLikeZip(bytes)) {
    return { ok: false, chunks: [], warnings: [], errorMessage: "不是有效的 xlsx 压缩包" };
  }
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(Buffer.from(bytes) as never);
  } catch (error) {
    return { ok: false, chunks: [], warnings: [], errorMessage: error instanceof Error ? error.message : "Excel 读取失败" };
  }
  const chunks: DocumentChunk[] = [];
  workbook.eachSheet((sheet) => {
    sheet.eachRow({ includeEmpty: false }, (row) => {
      const cells: { address: string; text: string }[] = [];
      row.eachCell({ includeEmpty: false }, (cell) => {
        const parsed = cellText(cell.value);
        const text = parsed.text.trim();
        if (!text) return;
        const shown = parsed.formula ? `${text}` : text;
        cells.push({ address: cell.address, text: shown });
        chunks.push(
          chunk(file, "excel", shown, {
            sheetName: sheet.name,
            cellRange: cell.address,
          }),
        );
      });
      if (cells.length > 1) {
        chunks.push(
          chunk(file, "excel", cells.map((c) => c.text).join(" "), {
            sheetName: sheet.name,
            cellRange: `${cells[0].address}:${cells[cells.length - 1].address}`,
          }),
        );
      }
    });
  });
  if (!chunks.length) return { ok: false, chunks: [], warnings: [], errorMessage: "工作簿没有可读单元格" };
  return { ok: true, chunks, warnings: [] };
}

export async function extractPdfChunks(file: { fileId: string; fileName: string }, bytes: Uint8Array): Promise<ChunkExtract> {
  if (!looksLikePdf(bytes)) return { ok: false, chunks: [], warnings: [], errorMessage: "不是 PDF" };
  try {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: bytes });
    const result = await parser.getText();
    await parser.destroy();
    const chunks: DocumentChunk[] = [];
    const warnings: string[] = [];
    let anyText = false;
    for (const page of result.pages || []) {
      const text = (page.text || "").trim();
      if (!text) {
        warnings.push(`第 ${page.num} 页无文本层，标记 OCR_REQUIRED`);
        chunks.push(chunk(file, "pdf", "", { page: page.num }));
        continue;
      }
      anyText = true;
      chunks.push(chunk(file, "pdf", text, { page: page.num }));
    }
    if (!anyText) {
      return { ok: true, chunks, warnings: ["无文本层，标记 OCR_REQUIRED"], textLayerMissing: true };
    }
    return { ok: true, chunks, warnings };
  } catch (error) {
    return { ok: false, chunks: [], warnings: [], errorMessage: error instanceof Error ? error.message : "PDF 读取失败" };
  }
}

function decodeXml(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"');
}

export function extractDocxChunks(file: { fileId: string; fileName: string }, bytes: Uint8Array): ChunkExtract {
  if (!looksLikeZip(bytes)) return { ok: false, chunks: [], warnings: [], errorMessage: "不是有效的 docx" };
  let files: Map<string, Buffer>;
  try {
    files = unzip(Buffer.from(bytes));
  } catch (error) {
    return { ok: false, chunks: [], warnings: [], errorMessage: error instanceof Error ? error.message : "docx 解压失败" };
  }
  const xml = files.get("word/document.xml")?.toString("utf8");
  if (!xml) return { ok: false, chunks: [], warnings: [], errorMessage: "docx 缺少正文" };
  const chunks: DocumentChunk[] = [];
  let table = 0;
  const withoutTables = xml.replace(/<w:tbl[\s\S]*?<\/w:tbl>/g, (tbl) => {
    table += 1;
    const texts = [...tbl.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => decodeXml(m[1])).filter(Boolean);
    if (texts.length) chunks.push(chunk(file, "docx", texts.join(" "), { table }));
    return "";
  });
  let paragraph = 0;
  for (const match of withoutTables.matchAll(/<w:p[\s\S]*?<\/w:p>/g)) {
    paragraph += 1;
    const texts = [...match[0].matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => decodeXml(m[1]));
    const text = texts.join("").trim();
    if (!text) continue;
    chunks.push(chunk(file, "docx", text, { paragraph }));
  }
  if (!chunks.length) return { ok: false, chunks: [], warnings: [], errorMessage: "Word 正文为空" };
  return { ok: true, chunks, warnings: [] };
}

export function extractImageChunks(file: { fileId: string; fileName: string }): ChunkExtract {
  return {
    ok: true,
    chunks: [chunk(file, "image", "", undefined)],
    warnings: ["图片需要视觉模型，当前未识别出文字，标记 VISION_REQUIRED。请人工补录，测算引擎仍可用。"],
  };
}

export async function extractDocumentChunks(
  file: { fileId: string; fileName: string; mimeType?: string },
  bytes: Uint8Array,
): Promise<ChunkExtract> {
  const ext = extensionOf(file.fileName);
  if (ext === ".xlsx" || ext === ".xls") return extractExcelChunks(file, bytes);
  if (ext === ".pdf") return extractPdfChunks(file, bytes);
  if (ext === ".docx") return extractDocxChunks(file, bytes);
  if (ext === ".png" || ext === ".jpg" || ext === ".jpeg") return extractImageChunks(file);
  return { ok: false, chunks: [], warnings: [], errorMessage: "不支持的文件类型" };
}
