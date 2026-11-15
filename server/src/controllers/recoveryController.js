import bcrypt from "bcryptjs";
import { User } from "../models/User.js";
import { emailService } from "../services/email.js";
import { hashRecoveryToken, issueRecoveryToken } from "../services/recoveryTokens.js";
import { HttpError } from "../utils/httpError.js";
import { emailSchemaRequest, emailVerificationTokenSchema, passwordResetSchema } from "../validation/schemas.js";

const genericResetMessage = "If a verified Washday account uses that email, a password reset link will be sent.";
const unavailableError = () => new HttpError(503, "Email delivery is not configured for this deployment.", "EMAIL_NOT_CONFIGURED");

async function deliverVerification(user, token) {
  if (!emailService.enabled) throw unavailableError();
  try {
    await emailService.sendVerification({ email: user.email, username: user.username, token });
  } catch (error) {
    await User.updateOne(
      { _id: user._id, emailVerificationTokenHash: hashRecoveryToken(token) },
      { $unset: { emailVerificationTokenHash: 1, emailVerificationExpiresAt: 1 } },
    );
    console.error("Could not send an email verification message.", error);
    throw new HttpError(503, "The verification email could not be sent. Try again later.", "EMAIL_DELIVERY_FAILED");
  }
}

export async function requestEmailVerification(req, res) {
  const user = await User.findById(req.session.userId);
  if (!user) throw new HttpError(404, "Account not found.", "USER_NOT_FOUND");
  if (!user.email) throw new HttpError(400, "Add a recovery email address first.", "EMAIL_REQUIRED");
  if (user.emailVerifiedAt) return res.json({ message: "Your email is already verified." });
  if (!emailService.enabled) throw unavailableError();

  const issued = issueRecoveryToken();
  const saved = await User.updateOne(
    { _id: user._id, emailNormalized: user.email.toLowerCase(), emailVerifiedAt: null },
    { $set: { emailVerificationTokenHash: issued.hash, emailVerificationExpiresAt: issued.expiresAt } },
  );
  if (saved.modifiedCount !== 1) throw new HttpError(409, "The email address changed. Refresh your account and try again.", "EMAIL_CHANGED");
  await deliverVerification(user, issued.token);
  res.json({ message: "Verification email sent. The link expires in 30 minutes." });
}

export async function verifyEmail(req, res) {
  const parsed = emailVerificationTokenSchema.safeParse(req.body);
  if (!parsed.success) throw new HttpError(400, "That verification link is invalid or expired.", "INVALID_VERIFICATION_TOKEN");
  const tokenHash = hashRecoveryToken(parsed.data.token);
  const user = await User.findOneAndUpdate(
    { emailVerificationTokenHash: tokenHash, emailVerificationExpiresAt: { $gt: new Date() }, emailVerifiedAt: null },
    {
      $set: { emailVerifiedAt: new Date() },
      $unset: { emailVerificationTokenHash: 1, emailVerificationExpiresAt: 1 },
    },
    { new: true },
  );
  if (!user) throw new HttpError(400, "That verification link is invalid or expired.", "INVALID_VERIFICATION_TOKEN");
  res.json({ message: "Email verified. Password recovery is now available." });
}

export async function requestPasswordReset(req, res) {
  const parsed = emailSchemaRequest.safeParse(req.body);
  if (!parsed.success) throw new HttpError(400, "Enter a valid email address.", "INVALID_EMAIL");
  if (!emailService.enabled) throw unavailableError();

  const user = await User.findOne({ emailNormalized: parsed.data.email, emailVerifiedAt: { $ne: null } }).select("+emailNormalized");
  if (!user) return res.status(202).json({ message: genericResetMessage });

  const issued = issueRecoveryToken();
  const saved = await User.updateOne(
    { _id: user._id, emailNormalized: user.emailNormalized, emailVerifiedAt: { $ne: null } },
    { $set: { passwordResetTokenHash: issued.hash, passwordResetExpiresAt: issued.expiresAt } },
  );
  if (saved.modifiedCount !== 1) return res.status(202).json({ message: genericResetMessage });

  try {
    await emailService.sendPasswordReset({ email: user.email, username: user.username, token: issued.token });
  } catch (error) {
    await User.updateOne(
      { _id: user._id, passwordResetTokenHash: issued.hash },
      { $unset: { passwordResetTokenHash: 1, passwordResetExpiresAt: 1 } },
    );
    console.error("Could not send a password reset message.", error);
  }
  res.status(202).json({ message: genericResetMessage });
}

export async function resetPassword(req, res) {
  const parsed = passwordResetSchema.safeParse(req.body);
  if (!parsed.success) throw new HttpError(400, parsed.error.issues.map((issue) => issue.message).join(" "), "INVALID_PASSWORD");
  const tokenHash = hashRecoveryToken(parsed.data.token);
  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);
  const mongoSession = await User.db.startSession();
  let resetUserId = null;
  try {
    await mongoSession.withTransaction(async () => {
      resetUserId = null;
      const user = await User.findOneAndUpdate(
        { passwordResetTokenHash: tokenHash, passwordResetExpiresAt: { $gt: new Date() } },
        {
          $set: { passwordHash },
          $unset: { passwordResetTokenHash: 1, passwordResetExpiresAt: 1 },
        },
        { new: true, session: mongoSession },
      ).select("_id");
      if (!user) return;
      resetUserId = user._id;
      await User.db.collection("sessions").deleteMany({
        session: { $regex: `\"userId\":\"${user._id.toString()}\"` },
      }, { session: mongoSession });
    });
  } finally {
    await mongoSession.endSession();
  }
  if (!resetUserId) throw new HttpError(400, "That password reset link is invalid or expired.", "INVALID_RESET_TOKEN");
  res.json({ message: "Password changed. Sign in again on your devices." });
}
