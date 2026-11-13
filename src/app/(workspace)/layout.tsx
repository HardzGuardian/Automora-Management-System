import type { ReactNode } from "react";
import { signOutAction } from "@/app/(auth)/login/actions";
import { AppShell } from "@/components/layout/app-shell";
import { visibleNav } from "@/components/layout/nav";
import { ToastProvider } from "@/components/ui/toast";
import { requireActor } from "@/lib/auth/require-actor";
import { getSession } from "@/lib/auth/session";
import { unreadCount } from "@/modules/notifications";

export default async function WorkspaceLayout({ children }: { children: ReactNode }) {
  const actor = await requireActor();
  const session = await getSession();
  const groups = visibleNav(actor.permissions);
  const unread = await unreadCount(actor).catch(() => 0); // a failing badge must never break the page

  return (
    <ToastProvider>
      <AppShell
        groups={groups}
        user={{ name: session?.user.name ?? "User", email: session?.user.email ?? "", roles: actor.roles }}
        unread={unread}
        signOut={signOutAction}
      >
        {children}
      </AppShell>
    </ToastProvider>
  );
}
