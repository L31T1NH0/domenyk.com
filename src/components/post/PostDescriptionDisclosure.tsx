export function PostDescriptionDisclosure({
  description,
  showLabel,
  hideLabel,
}: {
  description: string
  showLabel: string
  hideLabel: string
}) {
  return (
    <details className="group mb-5">
      <summary className="inline-flex min-h-7 cursor-pointer list-none items-center rounded-sm text-xs text-zinc-500 transition-colors hover:text-neutral-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500 dark:text-zinc-400 dark:hover:text-white dark:focus-visible:ring-neutral-300 [&::-webkit-details-marker]:hidden">
        <span className="group-open:hidden">{showLabel}</span>
        <span className="hidden group-open:inline">{hideLabel}</span>
      </summary>
      <p className="mt-2 max-w-[70ch] text-sm leading-relaxed text-neutral-700 dark:text-zinc-300">{description}</p>
    </details>
  )
}
