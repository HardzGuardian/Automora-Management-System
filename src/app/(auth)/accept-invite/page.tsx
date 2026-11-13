import Link from "next/link";
import { AuthShell } from "@/components/layout/auth-shell";
import { linkClass } from "@/components/ui/styles";
import { getInvitationPreview } from "@/modules/auth";
import { AcceptForm } from "./accept-form";

export const metadata = { title: "Accept invitation" };

export default async function AcceptInvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const preview = token ? await getInvitationPreview(token) : null;

  if (preview && token) {
    return (
      <AuthShell title={`Join ${preview.companyName}`} description={`${preview.email} · ${preview.roleName}`}>
        <AcceptForm token={token} />
      </AuthShell>
    );
  }
  return (
    <AuthShell
      title="Invitation not valid"
      description="This link is invalid or has expired. Ask your administrator to send a new invitation."
      footer={
        <Link href="/login" className={linkClass}>
          Back to sign in
        </Link>
      }
    >
      {null}
    </AuthShell>
  );
}
