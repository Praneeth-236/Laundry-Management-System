import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import test from "node:test";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { createPhotoStorage } from "../src/services/photoStorageAdapter.js";

async function readBody(stream) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}

test("local photo storage writes, reads, and deletes private files", async () => {
  const uploadDir = await mkdtemp(path.join(tmpdir(), "washday-photos-"));
  const storage = createPhotoStorage({ driver: "local", uploadDir });
  const key = "resident-abc.png";
  try {
    await storage.put(key, Buffer.from("png-bytes"), "image/png");
    const photo = await storage.get(key);
    assert.equal(photo.contentType, "image/png");
    assert.equal((await readBody(photo.body)).toString(), "png-bytes");
    await storage.delete(key);
    assert.equal(await storage.get(key), null);
  } finally {
    await rm(uploadDir, { recursive: true, force: true });
  }
});

test("S3-compatible photo storage keeps objects private and handles missing objects", async () => {
  const commands = [];
  const client = {
    async send(command) {
      commands.push(command);
      if (command instanceof GetObjectCommand) {
        if (command.input.Key === "missing.png") {
          throw Object.assign(new Error("missing"), { name: "NoSuchKey", $metadata: { httpStatusCode: 404 } });
        }
        return { Body: Readable.from([Buffer.from("cloud-photo")]), ContentType: "image/png", ContentLength: 11 };
      }
      return {};
    },
  };
  const storage = createPhotoStorage({
    driver: "s3",
    s3: { endpoint: "https://account.r2.cloudflarestorage.com", region: "auto", bucket: "washday-private", accessKeyId: "test-key", secretAccessKey: "test-secret" },
    client,
  });

  await storage.put("owner-1.png", Buffer.from("cloud-photo"), "image/png");
  const photo = await storage.get("owner-1.png");
  assert.equal(photo.contentType, "image/png");
  assert.equal(photo.contentLength, 11);
  assert.equal((await readBody(photo.body)).toString(), "cloud-photo");
  assert.equal(await storage.get("missing.png"), null);
  await storage.delete("owner-1.png");

  const put = commands.find((command) => command instanceof PutObjectCommand);
  assert.equal(put.input.Bucket, "washday-private");
  assert.equal(put.input.CacheControl, "private, no-store");
  assert.equal(commands.filter((command) => command instanceof GetObjectCommand).length, 2);
  assert.ok(commands.some((command) => command instanceof DeleteObjectCommand));
  await assert.rejects(storage.get("../outside.png"), TypeError);
});

test("S3-compatible storage rejects incomplete configuration", () => {
  assert.throws(() => createPhotoStorage({ driver: "s3", s3: { endpoint: "https://example.com" } }), /Complete S3-compatible storage settings/);
});
