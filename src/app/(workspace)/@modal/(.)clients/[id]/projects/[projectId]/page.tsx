import { RouteModal } from "@/components/ui/route-modal";
import Page, { metadata } from "../../../../../clients/[id]/projects/[projectId]/page";

export { metadata };

// A client's project in a pop-up over the client page. Opening the link directly still shows the full page.
export default function Modal({ params }: { params: Promise<{ id: string; projectId: string }> }) {
  return (
    <RouteModal>
      <Page params={params} />
    </RouteModal>
  );
}
