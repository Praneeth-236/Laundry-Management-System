import nodemailer from "nodemailer";

export function createEmailService({ host, port = 587, secure = false, user, password, from, appUrl, transporter } = {}) {
  const enabled = Boolean(host && from);
  const mailTransport = enabled ? (transporter ?? nodemailer.createTransport({
    host,
    port,
    secure,
    requireTLS: !secure,
    auth: user && password ? { user, pass: password } : undefined,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
    disableFileAccess: true,
    disableUrlAccess: true,
  })) : null;
  const baseUrl = appUrl?.replace(/\/$/, "");

  async function send({ to, subject, text, html }) {
    if (!enabled) return false;
    await mailTransport.sendMail({ from, to, subject, text, html });
    return true;
  }

  return Object.freeze({
    enabled,
    async sendVerification({ email, username, token }) {
      const link = `${baseUrl}/verify-email#${token}`;
      return send({
        to: email,
        subject: "Verify your Washday email",
        text: `Hi ${username},\n\nVerify your email address for Washday: ${link}\n\nThis link expires in 30 minutes. If you did not create this account, ignore this email.`,
        html: `<p>Hi ${username},</p><p><a href="${link}">Verify your email address for Washday</a></p><p>This link expires in 30 minutes. If you did not create this account, ignore this email.</p>`,
      });
    },
    async sendPasswordReset({ email, username, token }) {
      const link = `${baseUrl}/reset-password#${token}`;
      return send({
        to: email,
        subject: "Reset your Washday password",
        text: `Hi ${username},\n\nUse this link to choose a new Washday password: ${link}\n\nThis link expires in 30 minutes. If you did not request a reset, ignore this email.`,
        html: `<p>Hi ${username},</p><p><a href="${link}">Choose a new Washday password</a></p><p>This link expires in 30 minutes. If you did not request a reset, ignore this email.</p>`,
      });
    },
  });
}
