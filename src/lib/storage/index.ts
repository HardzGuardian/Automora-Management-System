import "server-only";
import { env } from "@/lib/env";
import type { StorageDriver } from "./driver";
import { localDriver } from "./local";
import { s3Driver } from "./s3";

export { sanitizeFileName, validateUpload, type UploadCheck } from "./allowlist";
export { newStorageKey } from "./keys";

function driver(): StorageDriver {
  return env.STORAGE_DRIVER === "s3" ? s3Driver : localDriver;
}

export const putObject = (key: string, bytes: Buffer, mime: string) => driver().put(key, bytes, mime);
export const getObject = (key: string) => driver().get(key);
export const deleteObject = (key: string) => driver().delete(key);
