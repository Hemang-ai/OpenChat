import fs from "fs";

/**
 * Extract text from a PDF file using pdf-parse v2 API.
 * v1's `pdf(buffer)` call signature is gone — must use `new PDFParse({ data })`.
 */
export async function extractPdfText(filePath: string): Promise<string> {
  if (!fs.existsSync(filePath)) {
    throw new Error(`PDF file not found: ${filePath}`);
  }
  const buffer = fs.readFileSync(filePath);

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require("pdf-parse");
  const PDFParse = mod.PDFParse || mod.default?.PDFParse || mod.default || mod;

  try {
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    const text = (result?.text || "").trim();
    if (!text) {
      throw new Error("PDF has no extractable text (it may be scanned/image-only — try OCR).");
    }
    return text;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to parse PDF: ${msg}`);
  }
}
