export interface StorageDriver {
  put(key: string, bytes: Buffer, mime: string): Promise<void>;
  get(key: string): Promise<Buffer>;
  /** Idempotent: deleting a missing object succeeds. */
  delete(key: string): Promise<void>;
}
