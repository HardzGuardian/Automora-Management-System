import { createElement } from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { getActor } from "@/lib/auth/actor";
import { DomainError } from "@/lib/errors";
import { getInvoicePdfData, InvoicePdfDocument } from "@/modules/finance";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const actor = await getActor();
    const { id } = await context.params;
    const data = await getInvoicePdfData(actor, id);
    const pdf = await renderToBuffer(createElement(InvoicePdfDocument, { data }));
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
      const status = error.code === "FORBIDDEN" ? 403
        : error.code.endsWith("_NOT_FOUND") ? 404
          : error.code === "VALIDATION" ? 400
            : 409;
      return Response.json({ error: { code: error.code, message: error.message } }, { status });
    }
    return Response.json({ error: { code: "INTERNAL_ERROR", message: "Unable to generate invoice PDF." } }, { status: 500 });
  }
}
