"use client";

import { useActionState, useEffect, useRef } from "react";
import { addCommentAction, uploadAttachmentAction, type CollabState } from "../collab-actions";

const initial: CollabState = {};

export function CommentForm({ taskId }: { taskId: string }) {
  const [state, action, pending] = useActionState(addCommentAction, initial);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state]);
  return (
    <form ref={ref} action={action} className="flex max-w-xl flex-col gap-2">
      <input type="hidden" name="taskId" value={taskId} />
      <label className="flex flex-col gap-1 text-sm">
        Add a comment
        <textarea name="body" required rows={3} maxLength={4000} className="rounded border border-border px-3 py-2" />
      </label>
      {state.error ? (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      ) : null}
      <button type="submit" disabled={pending} className="self-start rounded bg-primary px-3 py-2 text-white disabled:opacity-50">
        {pending ? "Posting…" : "Post comment"}
      </button>
    </form>
  );
}

export function UploadForm({ taskId }: { taskId: string }) {
  const [state, action, pending] = useActionState(uploadAttachmentAction, initial);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state]);
  return (
    <form ref={ref} action={action} className="flex max-w-xl flex-wrap items-end gap-2">
      <input type="hidden" name="taskId" value={taskId} />
      <label className="flex flex-col gap-1 text-sm">
        Attach a file (pdf, png, jpg, docx, xlsx, csv, txt — up to 10 MB)
        <input
          name="file"
          type="file"
          required
          accept=".pdf,.png,.jpg,.jpeg,.docx,.xlsx,.csv,.txt"
          className="rounded border border-border px-3 py-2"
        />
      </label>
      <button type="submit" disabled={pending} className="rounded bg-primary px-3 py-2 text-white disabled:opacity-50">
        {pending ? "Uploading…" : "Upload"}
      </button>
      {state.error ? (
        <p role="alert" className="w-full text-sm text-danger">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
