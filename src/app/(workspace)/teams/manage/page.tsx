import { redirect } from "next/navigation";

// Teams are managed from the Team tab now. Old links and bookmarks land there.
export default function ManageTeamsRedirect() {
  redirect("/teams");
}
