// Google Drive integration - coming soon
// This file is a placeholder with the architecture ready for future implementation.
// To implement: add @googleapis/drive and configure OAuth2 credentials.

export interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
}

export async function listGoogleDriveFiles(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _accessToken: string
): Promise<GoogleDriveFile[]> {
  throw new Error("Google Drive integration not yet implemented");
}

export async function extractGoogleDriveFileText(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _fileId: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _accessToken: string
): Promise<string> {
  throw new Error("Google Drive integration not yet implemented");
}
