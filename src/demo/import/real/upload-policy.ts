/**
 * 上传限制与模式。UI 不判断模式，只读服务端 DOCUMENT_PARSER_MODE。
 */

export const UPLOAD_LIMITS = {
  maxFiles: 8,
  maxFileBytes: 10 * 1024 * 1024,
  maxTotalBytes: 25 * 1024 * 1024,
  ttlMs: 2 * 60 * 60 * 1000,
} as const;

const ALLOWED_EXT = new Set([".xlsx", ".xls", ".pdf", ".docx", ".png", ".jpg", ".jpeg"]);

const MIME_BY_EXT: Record<string, string[]> = {
  ".xlsx": ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/octet-stream"],
  ".xls": ["application/vnd.ms-excel", "application/octet-stream"],
  ".pdf": ["application/pdf", "application/octet-stream"],
  ".docx": ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/octet-stream"],
  ".png": ["image/png"],
  ".jpg": ["image/jpeg"],
  ".jpeg": ["image/jpeg"],
};

const BLOCKED_EXT = /\.(exe|dll|bat|cmd|sh|js|mjs|cjs|html?|svg|php|jar|com|scr|ps1)$/i;

export type UploadCheck = { ok: true; ext: string } | { ok: false; message: string };

export function getDocumentParserMode(env: NodeJS.ProcessEnv = process.env): "demo" | "real" {
  return String(env.DOCUMENT_PARSER_MODE || "demo").toLowerCase() === "real" ? "real" : "demo";
}

export function safeFileId(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

export function extensionOf(name: string): string {
  const base = name.split(/[/\\]/).pop() || "";
  const i = base.lastIndexOf(".");
  return i >= 0 ? base.slice(i).toLowerCase() : "";
}

export function validateIncomingFile(input: {
  name: string;
  mimeType?: string;
  size: number;
}): UploadCheck {
  const name = input.name || "";
  if (!name || name.includes("..") || /[/\\]/.test(name) || name.includes("\0")) {
    return { ok: false, message: "文件名不合法" };
  }
  if (BLOCKED_EXT.test(name)) return { ok: false, message: "拒绝可执行或脚本文件" };
  const ext = extensionOf(name);
  if (!ALLOWED_EXT.has(ext)) return { ok: false, message: `${name}：类型不允许` };
  if (input.size <= 0) return { ok: false, message: `${name}：空文件` };
  if (input.size > UPLOAD_LIMITS.maxFileBytes) return { ok: false, message: `${name}：超过单文件大小上限` };
  const mime = (input.mimeType || "").split(";")[0].trim().toLowerCase();
  if (mime && mime !== "application/octet-stream") {
    const allowed = MIME_BY_EXT[ext] || [];
    if (!allowed.includes(mime) && !allowed.includes("application/octet-stream")) {
      return { ok: false, message: `${name}：扩展名与 MIME 不一致` };
    }
  }
  return { ok: true, ext };
}

export function looksLikeOleXls(bytes: Uint8Array): boolean {
  return bytes.length > 4 && bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0;
}

export function looksLikeZip(bytes: Uint8Array): boolean {
  return bytes.length > 4 && bytes[0] === 0x50 && bytes[1] === 0x4b;
}

export function looksLikePdf(bytes: Uint8Array): boolean {
  return bytes.length > 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
}
