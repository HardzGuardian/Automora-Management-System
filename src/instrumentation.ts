// Runs once when the server starts. Validates production config, then connects the notifications
// module to the shared notify port so task assignments, reviews and completions create in-app notifications.
export async function register(): Promise<void> {
  // eslint-disable-next-line no-restricted-properties -- Next.js sets NEXT_RUNTIME; it is not app configuration.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // `next build` also loads this file (with placeholder env); only enforce when actually serving.
  // eslint-disable-next-line no-restricted-properties -- NEXT_PHASE is set by Next.js, not app configuration.
  if (process.env.NEXT_PHASE !== "phase-production-build") {
    const { env, assertProductionEnv } = await import("@/lib/env");
    const { logger } = await import("@/lib/logger");
    try {
      assertProductionEnv(env);
    } catch (e) {
      logger.error("startup aborted: invalid production configuration", { err: e });
      throw e;
    }
  }

  const { registerNotifier } = await import("@/modules/notifications");
  registerNotifier();
}
