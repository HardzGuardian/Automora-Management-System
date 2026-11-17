import Link from "next/link";
import { Icon } from "@/components/ui/icons";

export const metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-background px-4 py-8">
      <div className="flex items-center gap-3">
        <span className="inline-flex size-10 items-center justify-center rounded-[10px] bg-primary text-xl font-bold text-white">A</span>
        <span className="text-[22px] font-bold tracking-tight">Automora</span>
      </div>
      <div className="flex w-full max-w-[480px] flex-col items-start gap-4 rounded-2xl border border-border bg-surface p-10">
        <div className="text-[72px] font-bold leading-none tracking-[-0.04em] text-primary">404</div>
        <h1 className="m-0 text-[28px] font-bold leading-[1.2] tracking-tight">We cannot find that page</h1>
        <p className="m-0 text-[15px] leading-[1.55] text-muted">
          It may have moved, or you may not have access to it. Check the link, or go back to your work.
        </p>
        <div className="flex w-full flex-wrap gap-3 pt-2">
          <Link href="/dashboard" className="inline-flex h-12 items-center justify-center gap-2 rounded-[10px] bg-primary px-[22px] text-[15px] font-semibold text-white hover:bg-primary-hover">
            Go to dashboard
            <Icon name="arrowRight" size={18} strokeWidth={2.2} />
          </Link>
          <Link href="/projects" className="inline-flex h-12 items-center justify-center rounded-[10px] border border-field bg-surface px-5 text-[15px] font-medium text-foreground hover:border-[#8e9a93] hover:bg-background">
            View projects
          </Link>
        </div>
      </div>
      <p className="m-0 text-xs text-muted">Automora Tech Solutions LLP · Internal use only</p>
    </div>
  );
}
