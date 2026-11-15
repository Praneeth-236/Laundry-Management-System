import { env } from "../config/env.js";
import { createEmailService } from "./emailService.js";

export const emailService = createEmailService({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_SECURE,
  user: env.SMTP_USER,
  password: env.SMTP_PASSWORD,
  from: env.SMTP_FROM,
  appUrl: env.PUBLIC_APP_URL,
});
