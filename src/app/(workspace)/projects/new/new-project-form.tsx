"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { Icon } from "@/components/ui/icons";
import { buttonClass, inputClass } from "@/components/ui/styles";
import { cn } from "@/lib/cn";
import { createProjectSetupAction, uploadProjectDocumentAction } from "../actions";

export type TeamOption = { id: string; name: string; department: string; people: string[] };
export type ClientOption = { id: string; name: string };

const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPT = ".pdf,.png,.jpg,.jpeg,.docx,.xlsx,.csv,.txt";

const fmtSize = (b: number) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

type Created = { id: string; name: string; client: string; teamLabel: string; people: string[]; uploaded: number; failed: string[]; teamError?: string };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-surface">
      <h2 className="m-0 border-b border-border px-5 py-4 text-base font-semibold text-foreground">{title}</h2>
      <div className="flex flex-col gap-4 p-5">{children}</div>
    </section>
  );
}

export function NewProjectForm({ clients, teams }: { clients: ClientOption[]; teams: TeamOption[] }) {
  const [name, setName] = useState("");
  const [clientId, setClientId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [fileNote, setFileNote] = useState<string | null>(null);
  const [teamId, setTeamId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [created, setCreated] = useState<Created | null>(null);
  const [pending, start] = useTransition();
  const picker = useRef<HTMLInputElement>(null);

  const addFiles = (list: FileList | File[]) => {
    const incoming = Array.from(list);
    const tooBig = incoming.filter((f) => f.size > MAX_BYTES).map((f) => f.name);
    const ok = incoming.filter((f) => f.size <= MAX_BYTES && f.size > 0);
    setFileNote(tooBig.length ? `${tooBig.join(", ")} ${tooBig.length === 1 ? "is" : "are"} over 10 MB and was not added.` : null);
    setFiles((cur) => [...cur, ...ok]);
    if (picker.current) picker.current.value = "";
  };

  const submit = () => {
    setError(null);
    setNameError(null);
    if (!name.trim()) {
      setNameError("Enter a project name.");
      setError("Enter a project name.");
      return;
    }
    if (!teamId) {
      setError("Choose the team this project is assigned to.");
      return;
    }
    start(async () => {
      const r = await createProjectSetupAction({ name, clientId, dueDate, description, teamId });
      if (!r.ok) {
        setError(r.error);
        setNameError(r.fieldErrors?.name?.[0] ?? null);
        return;
      }
      let uploaded = 0;
      const failed: string[] = [];
      for (const f of files) {
        const fd = new FormData();
        fd.set("projectId", r.id);
        fd.set("file", f);
        const u = await uploadProjectDocumentAction(fd).catch(() => ({ ok: false as const, error: "Upload failed" }));
        if (u.ok) uploaded++;
        else failed.push(`${f.name} (${u.error})`);
      }
      setCreated({
        id: r.id,
        name: name.trim(),
        client: clients.find((c) => c.id === clientId)?.name ?? "Internal",
        teamLabel: r.teamLabel,
        people: r.people,
        uploaded,
        failed,
        teamError: r.teamError,
      });
    });
  };

  if (created) {
    return (
      <section role="status" className="flex flex-col gap-3.5 rounded-lg border border-border bg-surface p-6">
        <div className="flex items-center gap-2.5 text-base font-semibold text-success">
          <Icon name="completed" size={22} />
          Project created
        </div>
        <p className="m-0 leading-relaxed text-body">
          “{created.name}” was created for {created.client} with {created.uploaded} reference document{created.uploaded === 1 ? "" : "s"}
          {created.teamError ? "." : ` and assigned to ${created.teamLabel}.`}
          {!created.teamError && created.people.length ? ` ${created.people.join(", ")} can see it now.` : ""}
        </p>
        {created.teamError ? <p role="alert" className="m-0 rounded-md bg-warning-soft p-3 text-sm text-warning">The team could not be assigned: {created.teamError} Open the project to try again.</p> : null}
        {created.failed.length ? (
          <p role="alert" className="m-0 rounded-md bg-danger-soft p-3 text-sm text-danger">
            Not uploaded: {created.failed.join("; ")}. Add them from the project page.
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2.5">
          <Link href={`/projects/${created.id}`} className={buttonClass("primary")}>Open project</Link>
          <Link href="/teams" className={buttonClass("secondary")}>See team work</Link>
          <Link href="/projects" className={buttonClass("secondary")}>Back to projects</Link>
        </div>
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {error ? (
        <p role="alert" className="m-0 rounded-lg bg-danger-soft px-4 py-3 font-medium text-danger">
          {error}
        </p>
      ) : null}

      <Section title="1. Project details">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="np-name" className="font-medium">
            Project name <span className="text-danger" aria-hidden="true">*</span>
            <span className="sr-only"> required</span>
          </label>
          <input
            id="np-name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
              setNameError(null);
            }}
            placeholder="For example, Website relaunch"
            className={inputClass}
            aria-invalid={nameError ? true : undefined}
            maxLength={200}
          />
        </div>
        <div className="flex flex-wrap gap-4">
          <div className="flex min-w-60 flex-1 flex-col gap-1.5">
            <label htmlFor="np-client" className="font-medium">Client</label>
            <select id="np-client" value={clientId} onChange={(e) => setClientId(e.target.value)} className={inputClass}>
              <option value="">Internal (no client)</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="flex min-w-48 flex-1 flex-col gap-1.5">
            <label htmlFor="np-due" className="font-medium">Due date</label>
            <input id="np-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputClass} />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="np-desc" className="font-medium">Description</label>
          <textarea
            id="np-desc"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What is this project and what should the team deliver?"
            className={cn(inputClass, "resize-y")}
            maxLength={2000}
          />
        </div>
      </Section>

      <Section title="2. Reference documents">
        <label
          htmlFor="np-files"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            addFiles(e.dataTransfer.files);
          }}
          className="flex min-h-[92px] cursor-pointer items-center justify-center gap-3 rounded-[10px] border-[1.5px] border-dashed border-[#8fa89a] bg-background p-3.5 text-center focus-within:outline focus-within:outline-2 focus-within:outline-primary"
        >
          <Icon name="upload" size={24} className="text-primary-ink" />
          <span>
            <span className="block font-medium">Drop files here or choose files</span>
            <span className="block text-xs text-muted">
              Briefs, contracts, designs. PDF, PNG, JPG, DOCX, XLSX, CSV or TXT, up to 10 MB each. Everyone on the team can open them.
            </span>
          </span>
          <input ref={picker} id="np-files" type="file" multiple accept={ACCEPT} className="sr-only" onChange={(e) => e.target.files && addFiles(e.target.files)} />
        </label>
        {fileNote ? <p role="alert" className="m-0 text-sm text-danger">{fileNote}</p> : null}
        {files.length > 0 ? (
          <ul className="m-0 list-none rounded-lg border border-border p-0">
            {files.map((f, i) => (
              <li key={`${f.name}-${i}`} className="flex items-center gap-3 border-t border-border py-2 pl-3.5 pr-2 first:border-t-0">
                <Icon name="documents" size={18} className="shrink-0 text-primary-ink" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{f.name}</span>
                  <span className="block text-xs text-muted">{fmtSize(f.size)}</span>
                </span>
                <button
                  type="button"
                  onClick={() => setFiles((cur) => cur.filter((_, j) => j !== i))}
                  aria-label={`Remove ${f.name}`}
                  className="min-h-11 rounded-lg px-3 font-medium text-danger hover:bg-danger-soft"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </Section>

      <Section title="3. Assign to a team">
        {teams.length === 0 ? (
          <p className="m-0 text-sm text-muted">There are no teams yet. Create a team under Team first, then assign the project to it.</p>
        ) : (
          <div role="group" aria-label="Teams" className="flex flex-col gap-2.5">
            {teams.map((t) => {
              const on = t.id === teamId;
              return (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => {
                    setTeamId(t.id);
                    setError(null);
                  }}
                  className={cn(
                    "flex min-h-14 items-center gap-3.5 rounded-lg px-3.5 py-2 text-left",
                    on ? "border-[1.5px] border-primary bg-primary-soft" : "border border-field bg-surface hover:bg-primary-soft",
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-foreground">{t.name}</span>
                    <span className="block text-xs text-muted">
                      {t.department} · {t.people.length ? t.people.join(", ") : "No members yet"}
                    </span>
                  </span>
                  {on ? <Icon name="check" size={20} strokeWidth={2.4} className="text-primary-ink" /> : null}
                </button>
              );
            })}
          </div>
        )}
        <p className="m-0 text-[13px] leading-normal text-muted">
          Every active member gets the project and its open tasks. People who join the team later get them too.
        </p>
      </Section>

      <div className="flex gap-2.5">
        <button type="button" onClick={submit} disabled={pending} className={cn(buttonClass("primary"), "px-[22px] font-semibold")}>
          {pending ? "Creating…" : "Create project"}
        </button>
        <Link href="/projects" className={buttonClass("secondary")}>Cancel</Link>
      </div>
    </div>
  );
}
