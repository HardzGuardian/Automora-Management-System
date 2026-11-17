import "server-only";
import nodemailer from "nodemailer";
import { env } from "@/lib/env";

export type Email = { to: string; subject: string; text: string };

/** SMTP delivery (Mailpit in dev). Throws on failure; callers decide whether that is fatal. */
export async function sendEmail(mail: Email): Promise<void> {
  const transport = nodemailer.createTransport(env.SMTP_URL);
  await transport.sendMail({ from: env.EMAIL_FROM, ...mail });
}
