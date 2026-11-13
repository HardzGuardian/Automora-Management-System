import { Field } from "@/components/ui/field";
import { inputClass } from "@/components/ui/styles";

export type ProjectChoice = { id: string; label: string };

/** Optional project picker. Submits `projectId` (empty string = no project), same as the old text input. */
export function ProjectSelect({ id, projects, defaultValue }: { id: string; projects: ProjectChoice[]; defaultValue?: string | null }) {
  return (
    <Field id={id} label="Project (optional)" hint="Link this record to a project so it shows in project finance.">
      <select id={id} name="projectId" defaultValue={defaultValue ?? ""} aria-describedby={`${id}-hint`} className={inputClass}>
        <option value="">No project</option>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.label}
          </option>
        ))}
      </select>
    </Field>
  );
}
