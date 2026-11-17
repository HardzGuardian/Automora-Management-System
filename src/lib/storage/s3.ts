import "server-only";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { env } from "@/lib/env";
import { assertValidKey } from "./keys";
import type { StorageDriver } from "./driver";

let client: S3Client | undefined;

function s3(): S3Client {
  client ??= new S3Client({
    region: env.S3_REGION,
    endpoint: env.S3_ENDPOINT,
    forcePathStyle: Boolean(env.S3_ENDPOINT), // MinIO and most S3-compatible stores
    credentials:
      env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY
        ? { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY }
        : undefined,
  });
  return client;
}

/**
 * S3-compatible driver (private bucket). Downloads stream through the app after the
 * permission check, so no object is ever reachable by URL alone.
 */
export const s3Driver: StorageDriver = {
  async put(key, bytes, mime) {
    assertValidKey(key);
    await s3().send(new PutObjectCommand({ Bucket: env.S3_BUCKET, Key: key, Body: bytes, ContentType: mime }));
  },
  async get(key) {
    assertValidKey(key);
    const res = await s3().send(new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
    if (!res.Body) throw new Error("Object has no body");
    return Buffer.from(await res.Body.transformToByteArray());
  },
  async delete(key) {
    assertValidKey(key);
    await s3().send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
  },
};
