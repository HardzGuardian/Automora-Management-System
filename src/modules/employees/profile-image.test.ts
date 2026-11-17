import { and, eq } from "drizzle-orm";
import sharp from "sharp";
import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db";
import { activityLogs, employees, files } from "@/db/schema";
import type { PermissionKey } from "@/lib/permissions";
import { getObject } from "@/lib/storage";
import { MANAGER_KEYS, workWorld } from "@/test/work";
import { canAccessProfileImage, removeProfileImage, setProfileImage } from "./profile-image";

const BOSS: PermissionKey[] = [...MANAGER_KEYS, "employees.read", "employees.update"];

const blank = (width: number, height: number) => sharp({ create: { width, height, channels: 3, background: "#336699" } });
let PNG: Buffer;
let JPG_WITH_GPS_TEXT: Buffer;
let WEBP: Buffer;
let TRANSPARENT_PNG: Buffer;

beforeAll(async () => {
  PNG = await blank(800, 600).png().toBuffer();
  JPG_WITH_GPS_TEXT = await blank(300, 200).jpeg().withExif({ IFD0: { Copyright: "private-location-data" } }).toBuffer();
  WEBP = await blank(100, 100).webp().toBuffer();
  TRANSPARENT_PNG = await sharp({ create: { width: 50, height: 50, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer();
});

const upload = (name: string, bytes: Buffer, mime = "image/png") => ({ name, mime, bytes });
const photoOf = async (employeeId: string) =>
  (await db.select({ id: employees.profileImageFileId }).from(employees).where(eq(employees.id, employeeId)))[0].id;
const fileRows = async (companyId: string) => (await db.select().from(files).where(eq(files.companyId, companyId))).length;
const storedBytes = async (fileId: string) => {
  const [row] = await db.select().from(files).where(eq(files.id, fileId));
  return getObject(row.storageKey);
};

describe("setProfileImage", () => {
  it("lets a person set their own photo and audits it", async () => {
    const w = await workWorld(BOSS);
    const me = await w.employee();
    const { fileId } = await setProfileImage(me.actor, me.employeeId, upload("me.png", PNG));
    expect(await photoOf(me.employeeId)).toBe(fileId);
    const [log] = await db
      .select()
      .from(activityLogs)
      .where(and(eq(activityLogs.entityId, me.employeeId), eq(activityLogs.action, "employee.profile_image_changed")));
    expect(log).toBeDefined();
  });

  it("stores a 256x256 JPEG whatever was uploaded, and keeps none of the original metadata", async () => {
    const w = await workWorld(BOSS);
    const me = await w.employee();
    for (const [name, bytes, mime] of [
      ["wide.png", PNG, "image/png"],
      ["phone.jpg", JPG_WITH_GPS_TEXT, "image/jpeg"],
      ["modern.webp", WEBP, "image/webp"],
      ["clear.png", TRANSPARENT_PNG, "image/png"],
    ] as const) {
      const { fileId } = await setProfileImage(me.actor, me.employeeId, upload(name, bytes, mime));
      const stored = await storedBytes(fileId);
      const meta = await sharp(stored).metadata();
      expect([meta.format, meta.width, meta.height], name).toEqual(["jpeg", 256, 256]);
      expect(meta.exif, name).toBeUndefined();
      expect(stored.includes(Buffer.from("private-location-data")), name).toBe(false);
      const [row] = await db.select().from(files).where(eq(files.id, fileId));
      expect(row).toMatchObject({ originalName: "photo.jpg", mimeType: "image/jpeg" });
    }
  });

  it("flattens transparency to white rather than black", async () => {
    const w = await workWorld(BOSS);
    const me = await w.employee();
    const { fileId } = await setProfileImage(me.actor, me.employeeId, upload("clear.png", TRANSPARENT_PNG));
    const { data } = await sharp(await storedBytes(fileId)).raw().toBuffer({ resolveWithObject: true });
    expect(data[0]).toBeGreaterThan(240);
  });

  it("replaces the old photo and deletes its file", async () => {
    const w = await workWorld(BOSS);
    const me = await w.employee();
    const first = await setProfileImage(me.actor, me.employeeId, upload("a.png", PNG));
    const second = await setProfileImage(me.actor, me.employeeId, upload("b.jpg", JPG_WITH_GPS_TEXT, "image/jpeg"));
    expect(await photoOf(me.employeeId)).toBe(second.fileId);
    expect(await db.select().from(files).where(eq(files.id, first.fileId))).toHaveLength(0);
    expect(await db.select().from(files).where(eq(files.id, second.fileId))).toHaveLength(1);
  });

  it("refuses to change someone else's photo without employees.update, and allows it with the permission", async () => {
    const w = await workWorld(BOSS);
    const a = await w.employee();
    const b = await w.employee();
    await expect(setProfileImage(a.actor, b.employeeId, upload("x.png", PNG))).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(removeProfileImage(a.actor, b.employeeId)).rejects.toMatchObject({ code: "FORBIDDEN" });
    const { fileId } = await setProfileImage(w.manager, b.employeeId, upload("x.png", PNG));
    expect(await photoOf(b.employeeId)).toBe(fileId);
  });

  it("rejects anything that does not decode as a PNG, JPEG or WebP image, and stores nothing", async () => {
    const w = await workWorld(BOSS);
    const me = await w.employee();
    const before = await fileRows(w.company.id);
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><script>alert(1)</script></svg>');
    const gif = await blank(10, 10).gif().toBuffer();
    const bad = [
      upload("cv.pdf", Buffer.from("%PDF-1.7\nx"), "application/pdf"),
      upload("notes.png", Buffer.from("just some text, not an image")),
      upload("logo.png", svg), // SVG renamed to .png
      upload("anim.png", gif), // a GIF renamed to .png
      upload("truncated.png", PNG.subarray(0, 40)),
      upload("empty.png", Buffer.alloc(0)),
    ];
    for (const input of bad) {
      await expect(setProfileImage(me.actor, me.employeeId, input), input.name).rejects.toMatchObject({ code: "VALIDATION" });
    }
    expect(await fileRows(w.company.id)).toBe(before);
    expect(await photoOf(me.employeeId)).toBeNull();
  });

  it("refuses an image with an absurd pixel count (decompression bomb)", async () => {
    const w = await workWorld(BOSS);
    const me = await w.employee();
    // 9000x9000 = 81 megapixels, solid colour so the file itself is tiny.
    const bomb = await blank(9000, 9000).png({ compressionLevel: 9 }).toBuffer();
    await expect(setProfileImage(me.actor, me.employeeId, upload("bomb.png", bomb))).rejects.toMatchObject({ code: "VALIDATION" });
    expect(await photoOf(me.employeeId)).toBeNull();
  });

  it("cannot touch an employee in another company", async () => {
    const w = await workWorld(BOSS);
    const other = await workWorld(BOSS);
    const victim = await other.employee();
    const before = await fileRows(w.company.id);
    await expect(setProfileImage(w.manager, victim.employeeId, upload("x.png", PNG))).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await fileRows(w.company.id)).toBe(before);
    expect(await photoOf(victim.employeeId)).toBeNull();
  });
});

describe("removeProfileImage", () => {
  it("clears the photo, deletes the file and audits; removing again is harmless", async () => {
    const w = await workWorld(BOSS);
    const me = await w.employee();
    const { fileId } = await setProfileImage(me.actor, me.employeeId, upload("me.png", PNG));
    await removeProfileImage(me.actor, me.employeeId);
    expect(await photoOf(me.employeeId)).toBeNull();
    expect(await db.select().from(files).where(eq(files.id, fileId))).toHaveLength(0);
    const [log] = await db
      .select()
      .from(activityLogs)
      .where(and(eq(activityLogs.entityId, me.employeeId), eq(activityLogs.action, "employee.profile_image_removed")));
    expect(log).toBeDefined();
    await expect(removeProfileImage(me.actor, me.employeeId)).resolves.toBeUndefined();
  });
});

describe("canAccessProfileImage", () => {
  it("allows the owner and directory readers, and denies colleagues and other companies", async () => {
    const w = await workWorld(BOSS);
    const owner = await w.employee();
    const colleague = await w.employee();
    const { fileId } = await setProfileImage(owner.actor, owner.employeeId, upload("me.png", PNG));
    const file = { id: fileId, companyId: w.company.id };

    expect(await canAccessProfileImage(owner.actor, file)).toBe(true);
    expect(await canAccessProfileImage(w.manager, file)).toBe(true); // employees.read
    expect(await canAccessProfileImage(colleague.actor, file)).toBe(false);

    const other = await workWorld(BOSS);
    expect(await canAccessProfileImage(other.manager, file)).toBe(false);
  });

  it("denies files that are not a profile photo", async () => {
    const w = await workWorld(BOSS);
    expect(await canAccessProfileImage(w.manager, { id: "00000000-0000-4000-8000-000000000000", companyId: w.company.id })).toBe(false);
  });
});
