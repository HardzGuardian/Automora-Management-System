import { Field } from "@/components/ui/field";
import { inputClass } from "@/components/ui/styles";

export type ProjectChoice = { id: string; label: string; clientId?: string | null };

/** Optional project picker. Submits `projectId` (empty string = no project), same as the old text input. */
export function ProjectSelect({
  id,
  projects,
  defaultValue,
  required = false,
  hint,
}: {
  id: string;
  projects: ProjectChoice[];
  defaultValue?: string | null;
  required?: boolean;
  hint?: string;
}) {
  return (
    <Field
      id={id}
      label={required ? "Project" : "Project (optional)"}
      required={required}
      hint={hint ?? "Link this record to a project so it shows in project finance."}
    >
      <select id={id} name="projectId" required={required} defaultValue={defaultValue ?? ""} aria-describedby={`${id}-hint`} className={inputClass}>
        <option value="" disabled={required}>
          {required ? "Select a project" : "No project"}
        </option>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.label}
          </option>
        ))}
      </select>
    </Field>
  );
}
