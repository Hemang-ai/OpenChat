export const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/octet-stream", // fallback for some browsers
];

export const ALLOWED_EXTENSIONS = [".pdf", ".docx", ".txt", ".md", ".csv"];

export function isAllowedFile(filename: string, mimeType: string): boolean {
  const ext = filename.substring(filename.lastIndexOf(".")).toLowerCase();
  return (
    ALLOWED_EXTENSIONS.includes(ext) ||
    ALLOWED_MIME_TYPES.includes(mimeType)
  );
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
