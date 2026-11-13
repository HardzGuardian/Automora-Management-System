"use client";

import { useActionState, useRef } from "react";
import { buttonClass } from "@/components/ui/styles";
import { uploadPhotoAction, type PhotoState } from "../photo-actions";

const initial: PhotoState = {};

/** One button: choosing a file uploads it straight away. */
export function PhotoUploadForm({ employeeId, hasPhoto }: { employeeId: string; hasPhoto: boolean }) {
  const [state, action, pending] = useActionState(uploadPhotoAction, initial);
  const form = useRef<HTMLFormElement>(null);
  return (
    <form ref={form} action={action} className="flex flex-col gap-1">
      <input type="hidden" name="employeeId" value={employeeId} />
      <label className={buttonClass("secondary", "cursor-pointer focus-within:ring-2 focus-within:ring-primary")}>
        {pending ? "Uploading…" : hasPhoto ? "Change photo" : "Add photo"}
        <input
          type="file"
          name="file"
          accept="image/png,image/jpeg,image/webp"
          disabled={pending}
          className="sr-only"
          onChange={(e) => {
            if (e.currentTarget.files?.length) form.current?.requestSubmit();
          }}
        />
      </label>
      {state.error ? (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      ) : null}
      <p role="status" className="sr-only">
        {state.ok ? "Photo updated" : ""}
      </p>
    </form>
  );
}
