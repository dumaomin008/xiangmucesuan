import type { ParsedDocument } from "./types";

export async function parseXlsxBuffer(buffer: Buffer, fileName: string): Promise<ParsedDocument> {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  const sections: ParsedDocument["sections"] = [];
  const lines: string[] = [];
  workbook.eachSheet((sheet) => {
    lines.push(`[SHEET: ${sheet.name}]`);
    sheet.eachRow((row, rowNumber) => {
      const values = (row.values as unknown[])
        .slice(1)
        .map((cell) => {
          if (cell == null) return "";
          if (typeof cell === "object" && "text" in (cell as { text?: string })) return String((cell as { text?: string }).text || "");
          if (typeof cell === "object" && "result" in (cell as { result?: unknown })) return String((cell as { result?: unknown }).result ?? "");
          return String(cell);
        })
        .map((v) => v.trim());
      if (values.every((v) => !v)) return;
      const line = values.join(" | ");
      lines.push(line);
      sections.push({ sheet: sheet.name, table: `R${rowNumber}`, content: line });
    });
    lines.push("");
  });
  const text = lines.join("\n").trim();
  return {
    sourceId: fileName,
    fileName,
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    text,
    sections,
    warnings: text ? [] : ["未从 Excel 中读到有值单元格。"],
  };
}
