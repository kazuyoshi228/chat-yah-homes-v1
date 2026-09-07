/**
 * mailer — 運用者向け通知メール（Gmail SMTP）
 *
 * 本体サイト（yah.homes-v2）と同じ Secret Manager の SMTP_USER / SMTP_PASS を共用する。
 * 🚨 宛先は運用者のみ。ゲストへは送らない（チャットは非履行・窓口誘導が原則）。
 */
import nodemailer from "nodemailer";
import { defineSecret } from "firebase-functions/params";

export const SMTP_USER = defineSecret("SMTP_USER");
export const SMTP_PASS = defineSecret("SMTP_PASS");

export function getTransport() {
  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user: SMTP_USER.value(), pass: SMTP_PASS.value() },
  });
}

export async function sendOpsMail(params: {
  to: string;
  subject: string;
  text: string;
}): Promise<void> {
  const from = SMTP_USER.value();
  await getTransport().sendMail({
    from: `yah.homes chat <${from}>`,
    to: params.to,
    subject: params.subject,
    text: params.text,
  });
}
