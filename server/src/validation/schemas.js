import { z } from "zod";

const passwordSchema = z.string().min(12).max(72)
  .refine((value) => Buffer.byteLength(value, "utf8") <= 72, "Password must be at most 72 UTF-8 bytes.");

export const credentialsSchema = z.object({
  username: z.string().trim().min(3).max(20).regex(/^[A-Za-z0-9_]+$/),
  password: passwordSchema,
}).strict();

const emailSchema = z.string().trim().email().max(254).transform((email) => email.toLowerCase());
export const registrationSchema = credentialsSchema.extend({ email: emailSchema }).strict();
export const emailSchemaRequest = z.object({ email: emailSchema }).strict();
export const emailVerificationTokenSchema = z.object({ token: z.string().regex(/^[A-Za-z0-9_-]{43}$/) }).strict();
export const passwordResetSchema = z.object({
  token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  newPassword: passwordSchema,
  confirmPassword: passwordSchema,
}).strict().refine((data) => data.newPassword === data.confirmPassword, {
  message: "New passwords do not match.",
  path: ["confirmPassword"],
});
export const recoveryEmailUpdateSchema = z.object({
  email: emailSchema,
  currentPassword: z.string().min(1).max(256),
}).strict();

export const clothingItemSchema = z.object({
  name: z.string().trim().min(1).max(80),
  category: z.string().trim().min(1).max(32),
}).strict();

export const categorySchema = z.object({ name: z.string().trim().min(1).max(32) }).strict();
export const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i);

export const sendLaundrySchema = z.object({
  itemIds: z.array(objectIdSchema).min(1).max(100),
}).strict().refine(({ itemIds }) => new Set(itemIds).size === itemIds.length, "Select each item only once.");

export const scheduleSchema = z.object({
  laundryDays: z.array(z.enum(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"])).max(7),
}).strict();

export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1).max(256),
  newPassword: passwordSchema,
  confirmPassword: passwordSchema,
}).strict().refine((data) => data.newPassword === data.confirmPassword, {
  message: "New passwords do not match.",
  path: ["confirmPassword"],
});

export const currentPasswordSchema = z.object({ currentPassword: z.string().min(1).max(256) }).strict();
