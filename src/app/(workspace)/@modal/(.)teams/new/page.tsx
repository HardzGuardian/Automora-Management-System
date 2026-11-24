import { RouteModal } from "@/components/ui/route-modal";
import Page, { metadata } from "../../../teams/new/page";

export { metadata };

// The same form as the full page, shown in a modal over the Team tab.
export default async function Modal({ searchParams }: { searchParams: Promise<{ department?: string }> }) {
  return (
    <RouteModal>
      <Page searchParams={searchParams} />
    </RouteModal>
  );
}
