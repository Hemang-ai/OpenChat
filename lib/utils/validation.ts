export const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/octet-stream", // fallback for some browsers
];

export const ALLOWED_EXTENSIONS = [".pdf", ".docx", ".txt", ".md", ".csv"];

const MIME_TYPES_BY_EXTENSION: Record<string, string[]> = {
  ".pdf": ["application/pdf"],
  ".docx": ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  ".txt": ["text/plain"],
  ".md": ["text/markdown", "text/x-markdown", "text/plain"],
  ".csv": ["text/csv", "application/csv", "application/vnd.ms-excel", "text/plain"],
};

export function isAllowedFile(filename: string, mimeType: string): boolean {
  const ext = filename.substring(filename.lastIndexOf(".")).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) return false;
  if (!mimeType || mimeType === "application/octet-stream") return true;
  return MIME_TYPES_BY_EXTENSION[ext]?.includes(mimeType) ?? false;
}

export function getMaxFileSizeBytes(): number {
  const mb = parseInt(process.env.MAX_FILE_SIZE_MB || "10", 10);
  return mb * 1024 * 1024;
}

export function isValidUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export function isYouTubeUrl(url: string): boolean {
  return /(?:youtube\.com|youtu\.be)/.test(url);
}

export function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
}
