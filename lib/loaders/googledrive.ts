import { extractDocxTextFromBuffer } from "@/lib/loaders/docx";
import { extractPdfTextFromBuffer } from "@/lib/loaders/pdf";

export interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  md5Checksum?: string;
  trashed?: boolean;
}

type DriveList<T> = { files?: T[]; changes?: Array<{ fileId: string; removed?: boolean; file?: T }>; nextPageToken?: string; newStartPageToken?: string; startPageToken?: string };

async function driveFetch<T>(url: string, accessToken: string): Promise<T> {
  const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" }, signal: AbortSignal.timeout(30_000), cache: "no-store" });
  if (!response.ok) throw new Error(`Google Drive request failed (HTTP ${response.status}). Reconnect Drive and try again.`);
  return response.json() as Promise<T>;
}

export async function listGoogleDriveFiles(accessToken: string, pageToken?: string): Promise<{ files: GoogleDriveFile[]; nextPageToken?: string }> {
  const query = new URLSearchParams({ pageSize: "100", q: "trashed = false", orderBy: "modifiedTime desc", fields: "nextPageToken,files(id,name,mimeType,modifiedTime,md5Checksum,trashed)" });
  if (pageToken) query.set("pageToken", pageToken);
  const data = await driveFetch<DriveList<GoogleDriveFile>>(`https://www.googleapis.com/drive/v3/files?${query}`, accessToken);
  return { files: data.files || [], nextPageToken: data.nextPageToken };
}

function exportMime(mimeType: string) {
  if (mimeType === "application/vnd.google-apps.document") return "text/plain";
  if (mimeType === "application/vnd.google-apps.spreadsheet") return "text/csv";
  if (mimeType === "application/vnd.google-apps.presentation") return "text/plain";
  return null;
}

export async function extractGoogleDriveFileText(file: GoogleDriveFile, accessToken: string): Promise<string> {
  const exported = exportMime(file.mimeType);
  const endpoint = exported
    ? `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}/export?mimeType=${encodeURIComponent(exported)}`
    : `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}?alt=media`;
  const response = await fetch(endpoint, { headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(60_000), cache: "no-store" });
  if (!response.ok) throw new Error(`Google Drive file download failed (HTTP ${response.status}).`);
  const buffer = Buffer.from(await response.arrayBuffer());
  if (file.mimeType === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) return extractPdfTextFromBuffer(buffer);
  if (file.mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || file.name.toLowerCase().endsWith(".docx")) return extractDocxTextFromBuffer(buffer);
  if (exported || file.mimeType.startsWith("text/") || /\.(txt|md|csv)$/i.test(file.name)) return buffer.toString("utf8").trim();
  throw new Error(`Google Drive file type ${file.mimeType} is not supported for text extraction.`);
}

export async function getGoogleDriveStartCursor(accessToken: string): Promise<string> {
  const data = await driveFetch<DriveList<GoogleDriveFile>>("https://www.googleapis.com/drive/v3/changes/startPageToken", accessToken);
  if (!data.startPageToken) throw new Error("Google Drive did not return a sync cursor.");
  return data.startPageToken;
}

export async function listGoogleDriveChanges(accessToken: string, cursor: string): Promise<{ changes: Array<{ fileId: string; removed: boolean; file?: GoogleDriveFile }>; nextCursor: string }> {
  const query = new URLSearchParams({ pageToken: cursor, pageSize: "100", includeRemoved: "true", fields: "nextPageToken,newStartPageToken,changes(fileId,removed,file(id,name,mimeType,modifiedTime,md5Checksum,trashed))" });
  const data = await driveFetch<DriveList<GoogleDriveFile>>(`https://www.googleapis.com/drive/v3/changes?${query}`, accessToken);
  return { changes: (data.changes || []).map((change) => ({ fileId: change.fileId, removed: Boolean(change.removed), file: change.file })), nextCursor: data.nextPageToken || data.newStartPageToken || cursor };
}
