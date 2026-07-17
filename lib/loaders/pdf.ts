import fs from "fs";
import { PDFParse } from "pdf-parse";

/**
 * Extract text from a PDF file using pdf-parse v2 API.
 * v1's `pdf(buffer)` call signature is gone — must use `new PDFParse({ data })`.
 */
export async function extractPdfText(filePath: string): Promise<string> {
  if (!fs.existsSync(filePath)) {
    throw new Error(`PDF file not found: ${filePath}`);
  }
  return extractPdfTextFromBuffer(fs.readFileSync(filePath));
}

export async function extractPdfTextFromBuffer(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    const text = (result?.text || "").trim();
    if (text) return text;

    const screenshots = await parser.getScreenshot({ desiredWidth: 1600, imageBuffer: true, imageDataUrl: false, first: 10 });
    const { createWorker } = await import("tesseract.js");
    const worker = await createWorker(process.env.OCR_LANGUAGES || "eng", undefined, {
      cachePath: "/tmp/openbusinesschat-ocr",
      langPath: process.env.OCR_LANGUAGE_DATA_URL || undefined,
      logger: process.env.NODE_ENV === "development" ? (event) => {
        if (event.status === "recognizing text") console.info(`OCR ${Math.round(event.progress * 100)}%`);
      } : undefined,
    });
    try {
      const pages: string[] = [];
      for (const page of screenshots.pages) {
        const recognized = await worker.recognize(Buffer.from(page.data));
        const pageText = recognized.data.text.trim();
        if (pageText) pages.push(`Page ${page.pageNumber}\n${pageText}`);
      }
      if (!pages.length) throw new Error("Local OCR did not find readable text in the first 10 pages.");
      return pages.join("\n\n");
    } finally {
      await worker.terminate();
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to parse PDF: ${msg}`);
  } finally {
    await parser.destroy().catch(() => undefined);
  }
}
