"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icons";
import { uploadProjectDocumentAction } from "../actions";

const MAX_BYTES = 10 * 1024 * 1024;

/** Drop zone for one or more files; each is sent on its own so one bad file never blocks the rest. */
export function DocUpload({ projectId }: { projectId: string }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const send = (list: FileList | File[]) => {
    const files = Array.from(list);
    if (files.length === 0) return;
    setNote(null);
    start(async () => {
      const done: string[] = [];
      const failed: string[] = [];
      for (const f of files) {
        if (f.size > MAX_BYTES) {
          failed.push(`${f.name} is over 10 MB`);
          continue;
        }
        const fd = new FormData();
        fd.set("projectId", projectId);
        fd.set("file", f);
        const r = await uploadProjectDocumentAction(fd).catch(() => ({ ok: false as const, error: "Upload failed" }));
        if (r.ok) done.push(f.name);
        else failed.push(`${f.name}: ${r.error}`);
      }
      if (input.current) input.current.value = "";
      setNote(
        failed.length
          ? { ok: false, text: `${failed.join("; ")}.${done.length ? ` ${done.join(", ")} uploaded.` : ""}` }
          : { ok: true, text: `${done.join(", ")} uploaded.` },
      );
      router.refresh();
    });
  };

  return (
    <div className="border-b border-border px-5 py-4">
      <label
        htmlFor="p-file"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          send(e.dataTransfer.files);
        }}
        className="flex min-h-[84px] cursor-pointer items-center justify-center gap-3 rounded-[10px] border-[1.5px] border-dashed border-[#8fa89a] bg-background p-3 text-center focus-within:outline focus-within:outline-2 focus-within:outline-primary"
      >
        <Icon name="upload" size={24} className="text-primary-ink" />
        <span>
          <span className="block font-medium">{pending ? "Uploading…" : "Drop a file here or choose one"}</span>
          <span className="block text-xs text-muted">PDF, PNG, JPG, DOCX, XLSX, CSV or TXT. Up to 10 MB.</span>
        </span>
        <input
          ref={input}
          id="p-file"
          type="file"
          multiple
          disabled={pending}
          accept=".pdf,.png,.jpg,.jpeg,.docx,.xlsx,.csv,.txt"
          className="sr-only"
          onChange={(e) => e.target.files && send(e.target.files)}
        />
      </label>
      {note ? (
        <p role={note.ok ? "status" : "alert"} className={note.ok ? "mb-0 mt-2.5 font-medium text-success" : "mb-0 mt-2.5 font-medium text-danger"}>
          {note.text}
        </p>
      ) : null}
    </div>
  );
}
