export type ParsedDocument = {
  sourceId: string;
  fileName: string;
  mimeType: string;
  text: string;
  sections?: {
    page?: number;
    sheet?: string;
    table?: string;
    content: string;
  }[];
  warnings: string[];
};
