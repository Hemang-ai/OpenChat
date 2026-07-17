import { createHash, randomUUID } from "crypto";
import { mkdir, readFile, rm, writeFile } from "fs/promises";
import path from "path";
import { GetObjectCommand, PutObjectCommand, DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";

const localRoot = path.join(process.cwd(), ".data", "uploads");

function s3Config() {
  const bucket = process.env.OBJECT_STORAGE_BUCKET;
  if (!bucket) return null;
  return {
    bucket,
    client: new S3Client({
      region: process.env.OBJECT_STORAGE_REGION || "auto",
      endpoint: process.env.OBJECT_STORAGE_ENDPOINT || undefined,
      forcePathStyle: process.env.OBJECT_STORAGE_FORCE_PATH_STYLE === "true",
      credentials: process.env.OBJECT_STORAGE_ACCESS_KEY_ID && process.env.OBJECT_STORAGE_SECRET_ACCESS_KEY ? {
        accessKeyId: process.env.OBJECT_STORAGE_ACCESS_KEY_ID,
        secretAccessKey: process.env.OBJECT_STORAGE_SECRET_ACCESS_KEY,
      } : undefined,
    }),
  };
}

function safeLocalPath(key: string) {
  const resolved = path.resolve(localRoot, key);
  if (!resolved.startsWith(`${localRoot}${path.sep}`)) throw new Error("Invalid private object key.");
  return resolved;
}

export async function putPrivateUpload(input: { workspaceId: string; botId: string; sourceId: string; fileName: string; body: Buffer; contentType?: string }) {
  const extension = path.extname(input.fileName).toLowerCase().replace(/[^.a-z0-9]/g, "");
  const tenant = createHash("sha256").update(input.workspaceId).digest("hex").slice(0, 20);
  const key = `${tenant}/${input.botId}/${input.sourceId}/${randomUUID()}${extension}`;
  const remote = s3Config();
  if (remote) {
    await remote.client.send(new PutObjectCommand({ Bucket: remote.bucket, Key: key, Body: input.body, ContentType: input.contentType || "application/octet-stream", ServerSideEncryption: "AES256" }));
    return `s3://${key}`;
  }
  if (process.env.NODE_ENV === "production") throw new Error("Private object storage is not configured. Set OBJECT_STORAGE_BUCKET and credentials.");
  const target = safeLocalPath(key);
  await mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
  await writeFile(target, input.body, { mode: 0o600 });
  return `local://${key}`;
}

export async function readPrivateUpload(reference: string) {
  const [scheme, key] = reference.split("://", 2);
  if (!key) throw new Error("Invalid private object reference.");
  if (scheme === "local") return readFile(safeLocalPath(key));
  if (scheme !== "s3") throw new Error("Unsupported private object reference.");
  const remote = s3Config();
  if (!remote) throw new Error("Private object storage is not configured.");
  const response = await remote.client.send(new GetObjectCommand({ Bucket: remote.bucket, Key: key }));
  if (!response.Body) throw new Error("The uploaded file is unavailable.");
  return Buffer.from(await response.Body.transformToByteArray());
}

export async function deletePrivateUpload(reference: string) {
  const [scheme, key] = reference.split("://", 2);
  if (!key) return;
  if (scheme === "local") {
    await rm(safeLocalPath(key), { force: true });
    return;
  }
  const remote = s3Config();
  if (scheme === "s3" && remote) await remote.client.send(new DeleteObjectCommand({ Bucket: remote.bucket, Key: key }));
}
