import fs from "fs";
import mammoth from "mammoth";

export async function extractDocxText(filePath: string): Promise<string> {
  return extractDocxTextFromBuffer(fs.readFileSync(filePath));
}

export async function extractDocxTextFromBuffer(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  const text = result.value.trim();
  if (!text) throw new Error("DOCX has no extractable text.");
  return text;
}
