import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { visibleNav } from "@/components/layout/nav";
import { FlashToast } from "@/components/ui/flash-toast";
import { ToastProvider } from "@/components/ui/toast";
import { readFlash } from "@/lib/flash";
import { createQuickTaskAction, loadQuickTaskOptions } from "./quick-task-actions";
import { requireActor } from "@/lib/auth/require-actor";
import { getSession } from "@/lib/auth/session";
import { unreadCount } from "@/modules/notifications";

export default async function WorkspaceLayout({ children, modal }: { children: ReactNode; modal: ReactNode }) {
  const actor = await requireActor();
  const session = await getSession();
  const { main, settings } = visibleNav(actor.permissions);
  const unread = await unreadCount(actor).catch(() => 0); // a failing badge must never break the page
  const flash = await readFlash();
  const canCreateTask = actor.permissions.has("tasks.create") && actor.permissions.has("tasks.assign");

  return (
    <ToastProvider>
      <AppShell
        main={main}
        settings={settings}
        quickTask={canCreateTask ? { load: loadQuickTaskOptions, create: createQuickTaskAction } : null}
        user={{ name: session?.user.name ?? "User", email: session?.user.email ?? "", roles: actor.roles }}
        unread={unread}
      >
        {children}
        {modal}
        {flash ? <FlashToast message={flash.message} tone={flash.tone} nonce={`${flash.tone}:${flash.message}`} /> : null}
      </AppShell>
    </ToastProvider>
  );
}
