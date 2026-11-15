import { env } from "../config/env.js";
import { createPhotoStorage } from "./photoStorageAdapter.js";

export const photoStorage = createPhotoStorage({
  driver: env.PHOTO_STORAGE_DRIVER,
  uploadDir: env.UPLOAD_DIR,
  s3: {
    endpoint: env.S3_ENDPOINT,
    region: env.S3_REGION,
    bucket: env.S3_BUCKET,
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY,
  },
});
