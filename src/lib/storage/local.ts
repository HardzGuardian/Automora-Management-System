import "server-only";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "@/lib/env";
import { assertValidKey } from "./keys";
import type { StorageDriver } from "./driver";

function resolveKey(key: string): string {
  assertValidKey(key);
  const root = path.resolve(env.STORAGE_LOCAL_DIR);
  const full = path.resolve(root, key);
  if (!full.startsWith(root + path.sep)) throw new Error("Invalid storage key");
  return full;
}

/** Filesystem driver for development and tests. Not for serverless hosting (use the s3 driver). */
export const localDriver: StorageDriver = {
  async put(key, bytes) {
    const full = resolveKey(key);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, bytes);
  },
  async get(key) {
    return readFile(resolveKey(key));
  },
  async delete(key) {
    try {
      await unlink(resolveKey(key));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    }
  },
};
