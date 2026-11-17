import { renderToBuffer } from "@react-pdf/renderer";
import { requireActorForApi } from "@/lib/auth/api-actor";
import { DomainError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { isUuid } from "@/lib/pagination";
import { getInvoicePdfData, InvoicePdfDocument } from "@/modules/finance";

export const runtime = "nodejs";

const json = (status: number, code: string, message: string) => Response.json({ error: { code, message } }, { status });

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const auth = await requireActorForApi();
  if (!auth.ok) return json(401, "UNAUTHENTICATED", "Sign in to download this invoice.");
  const { id } = await context.params;
  if (!isUuid(id)) return json(404, "INVOICE_NOT_FOUND", "Invoice was not found.");
  try {
    const data = await getInvoicePdfData(auth.actor, id);
    const pdf = await renderToBuffer(InvoicePdfDocument({ data }));
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="invoice-${id}.pdf"`,
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof DomainError) {
      const status = error.code === "FORBIDDEN" ? 403 : error.code.endsWith("_NOT_FOUND") ? 404 : error.code === "VALIDATION" ? 400 : 409;
      return json(status, error.code, error.message);
    }
    logger.error("invoice pdf failed", { invoiceId: id, err: error });
    return json(500, "INTERNAL", "Unable to generate invoice PDF.");
  }
}
