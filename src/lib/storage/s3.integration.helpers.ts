import type { FileAccessChecker } from "@/modules/files";

/** Test-only access checker that allows everything (the file service defaults to deny). */
export const canAccessAny: FileAccessChecker = async () => true;
