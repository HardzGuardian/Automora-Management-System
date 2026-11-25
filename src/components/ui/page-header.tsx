import type { ReactNode } from "react";
import { ControlPanel, type Crumb } from "./odoo";

/** A list or form page's header, drawn as the Odoo control panel: breadcrumbs, then the page's actions. */
export function PageHeader({ title, description, actions, crumbs = [] }: { title: string; description?: string; actions?: ReactNode; crumbs?: Crumb[] }) {
  return <ControlPanel crumbs={[...crumbs, { label: title }]} description={description} actions={actions} />;
}
