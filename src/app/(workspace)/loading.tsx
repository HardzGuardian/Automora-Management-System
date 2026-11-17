import { Skeleton, TableSkeleton } from "@/components/ui/states";

// Shown by Next.js while any workspace page loads (skeleton, not a spinner).
export default function Loading() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true">
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-10 w-full max-w-md" />
      <TableSkeleton rows={6} cols={5} />
    </div>
  );
}
