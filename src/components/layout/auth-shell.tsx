import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/ui/icons";

const POINTS: { icon: IconName; title: string; text: string }[] = [
  { icon: "projects", title: "Every project in one list", text: "See who is on it, what is open and when it is due." },
  { icon: "tasks", title: "Tasks go to a person", text: "Each task has one owner and sits inside its project." },
  { icon: "documents", title: "Files stay with the work", text: "Reference documents live inside their project." },
];

/**
 * Sign-in family layout (design): a deep green product panel on the left from `lg` up and the form
 * on the right. On mobile it is a single column with the wordmark above the form.
 */
export function AuthShell({ title, description, children, footer }: { title: string; description?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <main className="flex min-h-screen bg-surface">
      <aside aria-hidden="true" className="hidden w-[480px] flex-none flex-col justify-between bg-brand-deep p-12 text-white lg:flex">
        <div className="flex items-center gap-3">
          <span className="inline-flex size-10 items-center justify-center rounded-[10px] bg-white text-xl font-bold text-primary">A</span>
          <span className="text-[22px] font-bold tracking-tight">Automora</span>
        </div>
        <div className="flex flex-col gap-8">
          <p className="m-0 text-[34px] font-bold leading-[1.2] tracking-tight">Projects, tasks and files in one calm place.</p>
          {POINTS.map((p) => (
            <div key={p.title} className="flex items-start gap-3.5">
              <span className="inline-flex size-10 flex-none items-center justify-center rounded-[10px] bg-white/12">
                <Icon name={p.icon} size={20} />
              </span>
              <div>
                <div className="text-[15px] font-semibold">{p.title}</div>
                <div className="mt-0.5 text-sm leading-normal text-[#b9d8c8]">{p.text}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="text-[13px] text-[#8fbfa8]">Automora Tech Solutions LLP · Internal use only</div>
      </aside>
      <div className="flex min-w-0 flex-1 items-center justify-center px-8 py-12">
        <div className="flex w-full max-w-[400px] flex-col gap-6">
          <p className="m-0 text-xl font-bold text-primary-ink lg:hidden">Automora</p>
          <div>
            <h1 className="m-0 text-[28px] font-bold leading-[1.2] tracking-tight text-foreground">{title}</h1>
            {description ? <p className="mb-0 mt-2 text-[15px] leading-normal text-muted">{description}</p> : null}
          </div>
          {children}
          {footer ? <div className="border-t border-border pt-5 text-[13px] leading-normal text-muted">{footer}</div> : null}
        </div>
      </div>
    </main>
  );
}
