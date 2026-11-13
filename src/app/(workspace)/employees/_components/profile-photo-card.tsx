import { cardClass, buttonClass } from "@/components/ui/styles";
import { removePhotoAction } from "../photo-actions";
import { PhotoUploadForm } from "./photo-upload-form";

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

/** Circular photo, or the person's initials when there is none. */
export function Avatar({ fileId, name, size = 64 }: { fileId: string | null; name: string; size?: number }) {
  const style = { width: size, height: size };
  if (!fileId) {
    return (
      <span
        role="img"
        aria-label={`${name} has no photo`}
        style={style}
        className="inline-flex shrink-0 items-center justify-center rounded-full bg-primary-soft text-xl font-semibold text-primary"
      >
        {initials(name)}
      </span>
    );
  }
  return (
    // A plain <img>: the file is behind the session cookie, which next/image's optimiser would not send.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={`/api/files/${fileId}`} alt={`Photo of ${name}`} style={style} className="shrink-0 rounded-full object-cover" />
  );
}

/** The photo, plus Change and Remove when the viewer may edit it. No heading, no form fields. */
export function ProfilePhotoCard({ employeeId, name, fileId, canChange }: { employeeId: string; name: string; fileId: string | null; canChange: boolean }) {
  return (
    <div className={`${cardClass} flex items-center gap-4`}>
      <Avatar fileId={fileId} name={name} size={72} />
      {canChange ? (
        <div className="flex min-w-0 flex-col items-start gap-2">
          <PhotoUploadForm employeeId={employeeId} hasPhoto={fileId !== null} />
          {fileId ? (
            <form action={removePhotoAction}>
              <input type="hidden" name="employeeId" value={employeeId} />
              <button type="submit" className={buttonClass("ghost")}>
                Remove
              </button>
            </form>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
