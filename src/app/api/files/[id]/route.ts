import { z } from "zod";
import { requireActorForApi } from "@/lib/auth/api-actor";
import { DomainError } from "@/lib/errors";
import { readFile } from "@/modules/files";
import { canAccessTaskAttachment } from "@/modules/tasks";

// Every file is downloaded through this handler: authenticate → find the file in the actor's
// company → ask the owning modules whether the actor may see its parent record → stream bytes.
// Finance receipts add their checker here when that module exists.
const CHECKERS = [canAccessTaskAttachment];

const notFound = () => new Response("Not found", { status: 404 });

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const auth = await requireActorForApi();
  if (!auth.ok) return new Response("Unauthorized", { status: 401 });

  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) return notFound();

  try {
    const file = await readFile(auth.actor, id, CHECKERS);
    const ascii = file.name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
    return new Response(new Uint8Array(file.bytes), {
      headers: {
        "Content-Type": file.mime,
        "Content-Length": String(file.bytes.length),
        "Content-Disposition": `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(file.name)}`,
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    if (e instanceof DomainError && e.code === "NOT_FOUND") return notFound();
    throw e;
  }
}
