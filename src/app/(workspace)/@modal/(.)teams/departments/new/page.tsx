import { RouteModal } from "@/components/ui/route-modal";
import Page, { metadata } from "../../../../teams/departments/new/page";

export { metadata };

// The same form as the full page, shown in a modal over the Team tab.
export default async function Modal() {
  return (
    <RouteModal>
      <Page />
    </RouteModal>
  );
}
