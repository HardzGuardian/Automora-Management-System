import { getInvitationPreview } from "@/modules/auth";
import { AcceptForm } from "./accept-form";

export default async function AcceptInvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const preview = token ? await getInvitationPreview(token) : null;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      {preview && token ? (
        <>
          <h1 className="text-2xl font-semibold">Join {preview.companyName}</h1>
          <p className="text-sm text-gray-600">
            {preview.email} · {preview.roleName}
          </p>
          <AcceptForm token={token} />
        </>
      ) : (
        <>
          <h1 className="text-2xl font-semibold">Invitation not valid</h1>
          <p className="text-sm text-gray-600">
            This link is invalid or has expired. Ask your administrator to send a new invitation.
          </p>
        </>
      )}
    </main>
  );
}
