import { createReadStream } from "node:fs";
import { access, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const contentTypes = {
  ".gif": "image/gif",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

function safeKey(key) {
  if (typeof key !== "string" || path.basename(key) !== key || key.length > 200) {
    throw new TypeError("Photo key must be a safe file name.");
  }
  return key;
}

function isNotFound(error) {
  return error?.name === "NoSuchKey" || error?.name === "NotFound" || error?.$metadata?.httpStatusCode === 404;
}

export function createPhotoStorage({ driver = "local", uploadDir, s3 = {}, client } = {}) {
  if (driver !== "local" && driver !== "s3") throw new TypeError("Photo storage driver must be local or s3.");
  if (driver === "local" && !uploadDir) throw new TypeError("UPLOAD_DIR is required for local photo storage.");
  if (driver === "s3" && (!s3.endpoint || !s3.region || !s3.bucket || !s3.accessKeyId || !s3.secretAccessKey)) {
    throw new TypeError("Complete S3-compatible storage settings are required.");
  }

  const s3Client = driver === "s3" ? client ?? new S3Client({
    endpoint: s3.endpoint,
    region: s3.region,
    forcePathStyle: true,
    credentials: { accessKeyId: s3.accessKeyId, secretAccessKey: s3.secretAccessKey },
  }) : null;

  return Object.freeze({
    async put(key, buffer, contentType) {
      safeKey(key);
      if (driver === "s3") {
        await s3Client.send(new PutObjectCommand({
          Bucket: s3.bucket,
          Key: key,
          Body: buffer,
          ContentType: contentType,
          CacheControl: "private, no-store",
        }));
        return;
      }
      await mkdir(uploadDir, { recursive: true });
      await writeFile(path.join(uploadDir, key), buffer, { flag: "wx" });
    },

    async get(key) {
      safeKey(key);
      if (driver === "s3") {
        try {
          const result = await s3Client.send(new GetObjectCommand({ Bucket: s3.bucket, Key: key }));
          return { body: result.Body, contentType: result.ContentType ?? contentTypes[path.extname(key).toLowerCase()] ?? "application/octet-stream", contentLength: result.ContentLength };
        } catch (error) {
          if (isNotFound(error)) return null;
          throw error;
        }
      }
      const filePath = path.join(uploadDir, key);
      try { await access(filePath); }
      catch (error) { if (error?.code === "ENOENT") return null; throw error; }
      return { body: createReadStream(filePath), contentType: contentTypes[path.extname(key).toLowerCase()] ?? "application/octet-stream" };
    },

    async delete(key) {
      safeKey(key);
      if (driver === "s3") {
        await s3Client.send(new DeleteObjectCommand({ Bucket: s3.bucket, Key: key }));
        return;
      }
      await rm(path.join(uploadDir, key), { force: true });
    },
  });
}
