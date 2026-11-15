import { config as loadDotEnv } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../");
loadDotEnv({ path: resolve(projectRoot, ".env") });

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  MONGODB_URI: z.string().min(1).default("mongodb://127.0.0.1:27017/laundry?replicaSet=rs0"),
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be at least 32 characters."),
  UPLOAD_DIR: z.string().default(resolve(projectRoot, "server/uploads")),
});

const result = envSchema.safeParse(process.env);
if (!result.success) {
  console.error("Invalid server configuration:", result.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = Object.freeze({
  ...result.data,
  projectRoot,
  clientDist: resolve(projectRoot, "client/dist"),
  isProduction: result.data.NODE_ENV === "production",
});
