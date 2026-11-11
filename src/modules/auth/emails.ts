import type { Email } from "@/lib/email/send";

export function inviteEmail(to: string, companyName: string, acceptUrl: string): Email {
  return {
    to,
    subject: `You have been invited to ${companyName}`,
    text: `You have been invited to join ${companyName} on Automora.\n\nSet your password to activate your account (link valid for 7 days):\n${acceptUrl}\n\nIf you did not expect this, ignore this email.\n`,
  };
}

export function resetPasswordEmail(to: string, resetUrl: string): Email {
  return {
    to,
    subject: "Reset your Automora password",
    text: `We received a request to reset your password.\n\nUse this link within 1 hour:\n${resetUrl}\n\nIf you did not request this, ignore this email.\n`,
  };
}
