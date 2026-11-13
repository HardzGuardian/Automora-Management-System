import type { ReactNode } from "react";
import type { TimelineEntry } from "@/components/ui/activity-timeline";
import type { TaskActivityDTO } from "@/modules/tasks";

const FIELD_LABEL: Record<string, string> = {
  title: "title",
  description: "description",
  priority: "priority",
  projectId: "project",
  clientId: "client",
  startDate: "start date",
  dueDate: "due date",
  estimatedHours: "estimated hours",
  actualHours: "actual hours",
};

function asRecord(v: unknown): Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function show(v: unknown): string {
  if (v === null || v === undefined || v === "") return "none";
  return String(v);
}

function Val({ children }: { children: ReactNode }) {
  return <span className="font-medium">{children}</span>;
}

/** Turns a raw activity row into a sentence. `names` maps employee ids to names for assignment events. */
export function describeActivity(h: TaskActivityDTO, names: Map<string, string>): ReactNode {
  const oldV = asRecord(h.oldValue);
  const newV = asRecord(h.newValue);
  const person = (v: Record<string, unknown>) => {
    const id = typeof v.employeeId === "string" ? v.employeeId : "";
    return names.get(id) ?? "an employee";
  };
  switch (h.action) {
    case "created":
      return <>created this task</>;
    case "status_changed":
      return (
        <>
          changed status from <Val>{show(oldV.status)}</Val> to <Val>{show(newV.status)}</Val>
        </>
      );
    case "reopened":
      return (
        <>
          reopened the task (<Val>{show(oldV.status)}</Val> to <Val>{show(newV.status)}</Val>)
        </>
      );
    case "updated": {
      const keys = Object.keys(newV);
      if (keys.length === 0) return <>updated the task</>;
      return (
        <>
          {keys.map((k, i) => (
            <span key={k}>
              {i > 0 ? "; " : ""}
              {k === "description" || k === "projectId" || k === "clientId" ? (
                <>changed the {FIELD_LABEL[k]}</>
              ) : (
                <>
                  changed {FIELD_LABEL[k] ?? k} from <Val>{show(oldV[k])}</Val> to <Val>{show(newV[k])}</Val>
                </>
              )}
            </span>
          ))}
        </>
      );
    }
    case "assigned":
      return (
        <>
          assigned <Val>{person(newV)}</Val>
        </>
      );
    case "unassigned":
      return (
        <>
          removed <Val>{person(oldV)}</Val> from the assignees
        </>
      );
    case "reassigned":
      return (
        <>
          reassigned from <Val>{person(oldV)}</Val> to <Val>{person(newV)}</Val>
        </>
      );
    case "comment_added":
      return <>added a comment</>;
    case "comment_edited":
      return <>edited a comment</>;
    case "comment_deleted":
      return <>deleted a comment</>;
    case "attachment_added":
      return (
        <>
          attached <Val>{show(newV.name)}</Val>
        </>
      );
    case "attachment_removed":
      return (
        <>
          removed the attachment <Val>{show(oldV.name)}</Val>
        </>
      );
    case "archived":
      return <>archived the task</>;
    default:
      return <>{h.action.replace(/_/g, " ")}</>;
  }
}

export function toTimeline(history: TaskActivityDTO[], names: Map<string, string>): TimelineEntry[] {
  return history.map((h) => ({ id: h.id, actor: h.actorName ?? "System", text: describeActivity(h, names), at: h.createdAt }));
}
