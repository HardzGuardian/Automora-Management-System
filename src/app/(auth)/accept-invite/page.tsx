import Link from "next/link";
import { AuthShell } from "@/components/layout/auth-shell";
import { Icon } from "@/components/ui/icons";
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
      <AuthShell
        title="Welcome to Automora"
        description="Choose a password to finish setting up your account."
        footer="This link works once and expires 7 days after the invitation was sent."
      >
        <dl className="m-0 grid grid-cols-[84px_minmax(0,1fr)] gap-x-2.5 gap-y-2 rounded-[10px] border border-border bg-background px-4 py-3.5 text-sm">
          <dt className="text-muted">Email</dt>
          <dd className="m-0 font-semibold">{preview.email}</dd>
          <dt className="text-muted">Role</dt>
          <dd className="m-0 font-semibold">{preview.roleName}</dd>
          <dt className="text-muted">Company</dt>
          <dd className="m-0 font-semibold">{preview.companyName}</dd>
        </dl>
        <AcceptForm token={token} />
      </AuthShell>
    );
  }
  return (
    <AuthShell title="Invitation not valid" description="This link is invalid or has expired. Ask your administrator to send a new invitation.">
      <Link href="/login" className="inline-flex items-center gap-1 self-start rounded font-medium text-primary-ink hover:underline">
        <Icon name="chevronLeft" size={18} strokeWidth={2.2} />
        Back to sign in
      </Link>
    </AuthShell>
  );
}
