declare module 'pdf-parse' {
  interface PDFParseResult {
    numpages: number;
    numrender: number;
    info: Record<string, unknown> | null;
    metadata: unknown;
    text: string;
    version: string;
  }

  interface PDFParseOptions {
    max?: number;
    pagerender?: (pageData: unknown) => string | Promise<string>;
    version?: string;
  }

  function pdfParse(data: Buffer | Uint8Array, options?: PDFParseOptions): Promise<PDFParseResult>;

  export default pdfParse;
}
