import "server-only";
import type { Actor } from "@/lib/auth/actor";
import { DomainError } from "@/lib/errors";
import { requiresSecondConfirmer } from "@/modules/settings";

export const SECOND_PERSON_MESSAGE = "Company policy: a different person must confirm this payment.";

/**
 * Two-person rule (off by default, company setting). When on, whoever recorded a receipt or
 * outgoing payment cannot also confirm it. Pass the recorder's user id, or the actor's own id when
 * they are trying to record a payment as already confirmed.
 */
export async function assertNotSelfConfirmed(actor: Actor, recordedBy: string | null): Promise<void> {
  if (recordedBy !== actor.userId) return;
  if (await requiresSecondConfirmer(actor.companyId)) throw new DomainError("FORBIDDEN", SECOND_PERSON_MESSAGE);
}
