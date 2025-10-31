import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/solid";
import { buildUrl } from "../src/lib/url";

export default function Pagination({
  page,
  hasNext,
  pathname,
  searchParams,
}: {
  page: number;
  hasNext: boolean;
  pathname: string;
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const prevEnabled = page > 1;
  const nextEnabled = hasNext;

  const prevHref = prevEnabled
    ? buildUrl(pathname, searchParams, { page: page - 1 })
    : undefined;
  const nextHref = nextEnabled
    ? buildUrl(pathname, searchParams, { page: page + 1 })
    : undefined;

  return (
    <div className="mt-12 flex items-center justify-center gap-6 text-[0.68rem] uppercase tracking-[0.3em] text-[var(--color-muted)]">
      <Link
        aria-disabled={!prevEnabled}
        className={`motion-scale inline-flex items-center gap-2 rounded-full border border-[rgba(255,255,255,0.12)] bg-[rgba(16,16,16,0.65)] px-4 py-2 transition hover:text-[var(--color-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] ${
          prevEnabled ? "" : "pointer-events-none opacity-40"
        }`}
        href={prevHref || "#"}
        prefetch={false}
        tabIndex={prevEnabled ? 0 : -1}
      >
        <ChevronLeftIcon className="size-4" /> Anterior
      </Link>
      <span className="text-[var(--color-text)]">{page}</span>
      <Link
        aria-disabled={!nextEnabled}
        className={`motion-scale inline-flex items-center gap-2 rounded-full border border-[rgba(255,255,255,0.12)] bg-[rgba(16,16,16,0.65)] px-4 py-2 transition hover:text-[var(--color-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] ${
          nextEnabled ? "" : "pointer-events-none opacity-40"
        }`}
        href={nextHref || "#"}
        prefetch={false}
        tabIndex={nextEnabled ? 0 : -1}
      >
        Próxima <ChevronRightIcon className="size-4" />
      </Link>
    </div>
  );
}
