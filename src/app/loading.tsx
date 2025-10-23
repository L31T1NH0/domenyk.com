export default function Loading() {
  return (
    <div className="p-4">
      <div className="flex flex-col gap-4">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="animate-pulse">
            <div className="h-6 bg-zinc-200/50 rounded w-4/5 mb-2" />
            <div className="flex gap-2">
              <div className="h-4 bg-zinc-200/50 rounded w-24" />
              <div className="h-4 bg-zinc-200/50 rounded w-16" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
