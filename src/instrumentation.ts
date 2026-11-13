// Runs once when the server starts. Connects the notifications module to the shared notify port
// so task assignments, reviews and completions create in-app notifications.
export async function register(): Promise<void> {
  // eslint-disable-next-line no-restricted-properties -- Next.js sets NEXT_RUNTIME; it is not app configuration.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { registerNotifier } = await import("@/modules/notifications");
  registerNotifier();
}
