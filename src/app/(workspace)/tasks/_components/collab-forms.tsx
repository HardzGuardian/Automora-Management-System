"use client";

import { useActionState, useEffect, useRef } from "react";
import { Alert } from "@/components/ui/alert";
import { Field } from "@/components/ui/field";
import { buttonClass, inputClass } from "@/components/ui/styles";
import { addCommentAction, uploadAttachmentAction, type CollabState } from "../collab-actions";

const initial: CollabState = {};

export function CommentForm({ taskId }: { taskId: string }) {
  const [state, action, pending] = useActionState(addCommentAction, initial);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state]);
  return (
    <form ref={ref} action={action} className="flex w-full max-w-xl flex-col gap-3">
      <input type="hidden" name="taskId" value={taskId} />
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      <Field id={`comment-${taskId}`} label="Add a comment" hint="Up to 4000 characters.">
        <textarea
          id={`comment-${taskId}`}
          name="body"
          required
          rows={3}
          maxLength={4000}
          className={inputClass}
          aria-describedby={`comment-${taskId}-hint`}
        />
      </Field>
      <div>
        <button type="submit" disabled={pending} className={buttonClass("secondary")}>
          {pending ? "Posting…" : "Post comment"}
        </button>
      </div>
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
    <form ref={ref} action={action} className="flex w-full max-w-xl flex-col gap-3">
      <input type="hidden" name="taskId" value={taskId} />
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      <Field id={`file-${taskId}`} label="Attach a file" hint="pdf, png, jpg, docx, xlsx, csv or txt, up to 10 MB.">
        <input
          id={`file-${taskId}`}
          name="file"
          type="file"
          required
          accept=".pdf,.png,.jpg,.jpeg,.docx,.xlsx,.csv,.txt"
          className={inputClass}
          aria-describedby={`file-${taskId}-hint`}
        />
      </Field>
      <div>
        <button type="submit" disabled={pending} className={buttonClass("secondary")}>
          {pending ? "Uploading…" : "Upload"}
        </button>
      </div>
    </form>
  );
}
