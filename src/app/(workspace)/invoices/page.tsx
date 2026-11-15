import { redirect } from "next/navigation";

// The lists live on the Finance page now; old links and bookmarks land on the right tab.
export default function InvoicesListRedirect() {
  redirect("/finance?tab=invoices");
}
