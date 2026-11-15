import { redirect } from "next/navigation";

// New tasks are created from the New task button in the top bar (or from a project). Old links land on Tasks.
export default function NewTaskRedirect() {
  redirect("/tasks");
}
