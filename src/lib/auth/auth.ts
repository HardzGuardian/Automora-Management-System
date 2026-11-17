import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { APIError } from "better-auth/api";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { account, rateLimit, session, user, verification } from "@/db/schema";
import { sendEmail } from "@/lib/email/send";
import { resetPasswordEmail } from "@/lib/email/templates";
import { env } from "@/lib/env";

// Better Auth handles identity and sessions only. Authorisation (roles, permissions,
// record scope) is our own code in lib/permissions. A suspended user is `user.banned`.
export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: { user, session, account, verification, rateLimit },
  }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: true, // users are created only through invitations
    minPasswordLength: 10,
    revokeSessionsOnPasswordReset: true,
    resetPasswordTokenExpiresIn: 60 * 60, // single-use (token is deleted on use), 1 hour
    sendResetPassword: async ({ user: u, url }) => {
      // Not awaited and errors swallowed so response time/shape never reveals whether the email exists.
      void sendEmail(resetPasswordEmail(u.email, url)).catch(() => undefined);
    },
  },
  user: {
    additionalFields: {
      companyId: { type: "string", required: true, input: false },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
  },
  rateLimit: {
    enabled: true, // also in dev/test; default is production-only
    storage: "database", // shared across instances (table rate_limit)
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/request-password-reset": { window: 60, max: 3 },
      "/reset-password": { window: 60, max: 5 },
    },
  },
  databaseHooks: {
    session: {
      create: {
        // A suspended user (user.banned, unless the ban has expired) cannot start a session.
        before: async (s) => {
          const [u] = await db
            .select({ banned: user.banned, banExpires: user.banExpires })
            .from(user)
            .where(eq(user.id, s.userId));
          if (u?.banned && (!u.banExpires || u.banExpires > new Date())) {
            throw new APIError("FORBIDDEN", { message: "This account is suspended" });
          }
        },
        after: async (s) => {
          await db.update(user).set({ lastLoginAt: new Date() }).where(eq(user.id, s.userId));
        },
      },
    },
  },
  plugins: [nextCookies()],
});

export type Auth = typeof auth;
