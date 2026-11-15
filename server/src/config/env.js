import { config as loadDotEnv } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../");
loadDotEnv({ path: resolve(projectRoot, ".env") });

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DEPLOYMENT_MODE: z.enum(["demo", "production"]).default("demo"),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  MONGODB_URI: z.string().min(1).default("mongodb://127.0.0.1:27017/laundry?replicaSet=rs0"),
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be at least 32 characters."),
  UPLOAD_DIR: z.string().default(resolve(projectRoot, "server/uploads")),
  PHOTO_STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
  S3_ENDPOINT: z.string().url().optional(),
  S3_REGION: z.string().default("auto"),
  S3_BUCKET: z.string().min(1).optional(),
  S3_ACCESS_KEY_ID: z.string().min(1).optional(),
  S3_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  SMTP_HOST: z.string().min(1).optional(),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(587),
  SMTP_SECURE: z.enum(["true", "false"]).default("false").transform((value) => value === "true"),
  SMTP_USER: z.string().min(1).optional(),
  SMTP_PASSWORD: z.string().min(1).optional(),
  SMTP_FROM: z.string().email().optional(),
  PUBLIC_APP_URL: z.string().url().default("http://localhost:5173"),
}).superRefine((config, context) => {
  if (config.PHOTO_STORAGE_DRIVER === "s3") {
    for (const key of ["S3_ENDPOINT", "S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"]) {
      if (!config[key]) context.addIssue({ code: "custom", path: [key], message: `${key} is required when PHOTO_STORAGE_DRIVER=s3.` });
    }
    if (config.NODE_ENV === "production" && config.S3_ENDPOINT && new URL(config.S3_ENDPOINT).protocol !== "https:") {
      context.addIssue({ code: "custom", path: ["S3_ENDPOINT"], message: "S3_ENDPOINT must use HTTPS in production." });
    }
  }
  if (config.SMTP_HOST && !config.SMTP_FROM) {
    context.addIssue({ code: "custom", path: ["SMTP_FROM"], message: "SMTP_FROM is required when SMTP_HOST is configured." });
  }
  if (Boolean(config.SMTP_USER) !== Boolean(config.SMTP_PASSWORD)) {
    context.addIssue({ code: "custom", path: ["SMTP_USER"], message: "SMTP_USER and SMTP_PASSWORD must be configured together." });
  }
  if (config.NODE_ENV === "production" && new URL(config.PUBLIC_APP_URL).protocol !== "https:") {
    context.addIssue({ code: "custom", path: ["PUBLIC_APP_URL"], message: "PUBLIC_APP_URL must use HTTPS in production." });
  }
  if (config.DEPLOYMENT_MODE === "production") {
    if (config.NODE_ENV !== "production") {
      context.addIssue({ code: "custom", path: ["NODE_ENV"], message: "NODE_ENV must be production when DEPLOYMENT_MODE=production." });
    }
    if (config.PHOTO_STORAGE_DRIVER !== "s3") {
      context.addIssue({ code: "custom", path: ["PHOTO_STORAGE_DRIVER"], message: "Production deployment requires private S3-compatible photo storage." });
    }
    if (!config.SMTP_HOST || !config.SMTP_FROM) {
      context.addIssue({ code: "custom", path: ["SMTP_HOST"], message: "SMTP_HOST and SMTP_FROM are required when DEPLOYMENT_MODE=production." });
    }
    const usesTls = config.MONGODB_URI.startsWith("mongodb+srv://") || /[?&](?:tls|ssl)=true(?:&|$)/i.test(config.MONGODB_URI);
    if (!usesTls) {
      context.addIssue({ code: "custom", path: ["MONGODB_URI"], message: "MongoDB URI must enable TLS when DEPLOYMENT_MODE=production." });
    }
  }
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
