// Runs the real S3 driver against a real S3-compatible server (MinIO in CI).
// Skipped unless S3_TEST_ENDPOINT is set, so a normal `pnpm test` never needs MinIO:
//   docker run -d -p 9000:9000 -e MINIO_ROOT_USER=minioadmin -e MINIO_ROOT_PASSWORD=minioadmin minio/minio server /data
//   S3_TEST_ENDPOINT=http://localhost:9000 pnpm test src/lib/storage/s3.integration.test.ts
import { randomUUID } from "node:crypto";
import { CreateBucketCommand, HeadObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const endpoint = process.env.S3_TEST_ENDPOINT;
const accessKey = process.env.S3_TEST_ACCESS_KEY ?? "minioadmin";
const secretKey = process.env.S3_TEST_SECRET_KEY ?? "minioadmin";
const bucket = `automora-test-${randomUUID().slice(0, 8)}`;

describe.skipIf(!endpoint)("S3 storage driver against a real S3 server", () => {
  let driver: typeof import("./s3").s3Driver;
  let probe: S3Client;
  const keys: string[] = [];
  const newKey = () => {
    const k = `${randomUUID()}/${randomUUID()}`;
    keys.push(k);
    return k;
  };

  beforeAll(async () => {
    process.env.S3_ENDPOINT = endpoint;
    process.env.S3_BUCKET = bucket;
    process.env.S3_ACCESS_KEY_ID = accessKey;
    process.env.S3_SECRET_ACCESS_KEY = secretKey;
    process.env.STORAGE_DRIVER = "s3";
    vi.resetModules();

    probe = new S3Client({ region: "us-east-1", endpoint, forcePathStyle: true, credentials: { accessKeyId: accessKey, secretAccessKey: secretKey } });
    await probe.send(new CreateBucketCommand({ Bucket: bucket }));
    ({ s3Driver: driver } = await import("./s3"));
  });

  afterAll(async () => {
    if (driver) await Promise.all(keys.map((k) => driver.delete(k).catch(() => undefined)));
  });

  it("stores bytes and reads exactly the same bytes back", async () => {
    const key = newKey();
    const bytes = Buffer.from(Array.from({ length: 4096 }, (_, i) => i % 256));
    await driver.put(key, bytes, "application/octet-stream");
    expect((await driver.get(key)).equals(bytes)).toBe(true);
  });

  it("keeps the content type it was given", async () => {
    const key = newKey();
    await driver.put(key, Buffer.from("%PDF-1.7\nx"), "application/pdf");
    const head = await probe.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    expect(head.ContentType).toBe("application/pdf");
    expect(head.ContentLength).toBe(10);
  });

  it("handles a multi-megabyte object", async () => {
    const key = newKey();
    const bytes = Buffer.alloc(6 * 1024 * 1024, 7);
    await driver.put(key, bytes, "application/octet-stream");
    const back = await driver.get(key);
    expect(back.length).toBe(bytes.length);
    expect(back.equals(bytes)).toBe(true);
  });

  it("overwrites an existing key", async () => {
    const key = newKey();
    await driver.put(key, Buffer.from("one"), "text/plain");
    await driver.put(key, Buffer.from("two!"), "text/plain");
    expect((await driver.get(key)).toString()).toBe("two!");
  });

  it("fails clearly for a missing object, and delete is idempotent", async () => {
    const key = newKey();
    await expect(driver.get(key)).rejects.toThrow();
    await driver.put(key, Buffer.from("x"), "text/plain");
    await driver.delete(key);
    await expect(driver.get(key)).rejects.toThrow();
    await expect(driver.delete(key)).resolves.toBeUndefined(); // deleting again is fine
  });

  it("rejects path-traversal keys before any request is made", async () => {
    await expect(driver.put("../escape", Buffer.from("x"), "text/plain")).rejects.toThrow();
    await expect(driver.get("a/../../b")).rejects.toThrow();
    await expect(driver.delete("/absolute")).rejects.toThrow();
  });

  it("works end to end through the file service (validation, key generation, storage)", async () => {
    const { saveUpload, readFile } = await import("@/modules/files");
    const { buildActor, createCompany, createUser } = await import("@/test/factories");
    const { canAccessAny } = await import("./s3.integration.helpers");
    const company = await createCompany();
    const u = await createUser(company.id);
    const actor = buildActor({ companyId: company.id, userId: u.id });

    const pdf = Buffer.from("%PDF-1.7\nhello s3");
    const saved = await saveUpload(actor, { name: "report.pdf", mime: "application/pdf", bytes: pdf });
    const read = await readFile(actor, saved.id, [canAccessAny]);
    expect(read.bytes.equals(pdf)).toBe(true);
    expect(read).toMatchObject({ name: "report.pdf", mime: "application/pdf" });
  });
});
