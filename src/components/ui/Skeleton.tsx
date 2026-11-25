export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-slate-200/80 dark:bg-slate-800/80 ${className}`}
      aria-hidden="true"
    />
  );
}

export function TableRowsSkeleton({ rows = 6, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, rIdx) => (
        <tr key={rIdx} className="border-b border-slate-200/80 dark:border-slate-800/80">
          {Array.from({ length: cols }).map((__, cIdx) => (
            <td key={cIdx} className="px-4 py-3.5">
              <Skeleton className="h-4 w-full max-w-[140px]" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
