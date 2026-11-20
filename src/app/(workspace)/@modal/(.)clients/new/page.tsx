import Page, { metadata } from "../../../clients/new/page";
import { RouteModal } from "@/components/ui/route-modal";

export { metadata };

// The same form as the full page, shown in a modal over the list. A direct visit to the URL still shows the full page.
export default async function Modal() {
  return (
    <RouteModal>
      <Page />
    </RouteModal>
  );
}
