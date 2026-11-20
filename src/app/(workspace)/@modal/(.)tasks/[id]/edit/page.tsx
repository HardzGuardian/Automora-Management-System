import { RouteModal } from "@/components/ui/route-modal";
import Page, { metadata } from "../../../../tasks/[id]/edit/page";

export { metadata };

// The edit form in a modal over the task. A direct visit to the URL still shows the full page.
export default function Modal({ params }: { params: Promise<{ id: string }> }) {
  return (
    <RouteModal>
      <Page params={params} />
    </RouteModal>
  );
}
