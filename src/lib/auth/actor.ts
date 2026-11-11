import type { PermissionKey } from "@/lib/permissions/catalog";

export type Actor = {
  userId: string;
  companyId: string;
  employeeId: string | null;
  roles: string[];
  permissions: ReadonlySet<PermissionKey>;
  timezone: string;
};

/**
 * The only way services get an Actor in app code: reads the Better Auth session,
 * loads roles/permissions, rejects suspended users. Services never read cookies/headers.
 */
export async function getActor(): Promise<Actor> {
  const [{ getSession }, { loadActor }, { DomainError }] = await Promise.all([
    import("./session"),
    import("./load-actor"),
    import("@/lib/errors"),
  ]);
  const session = await getSession();
  if (!session) throw new DomainError("UNAUTHENTICATED", "Not signed in");
  return loadActor(session.user.id);
}
