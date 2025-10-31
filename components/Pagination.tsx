import Link from "next/link";
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
    <nav className="mt-12 flex items-center justify-between border-t border-neutral-900 pt-6 text-[11px] uppercase tracking-[0.35em] text-neutral-600">
      <Link
        aria-disabled={!prevEnabled}
        className={`border border-neutral-800 px-3 py-2 transition-colors hover:border-neutral-500 hover:text-neutral-100 ${
          prevEnabled ? "" : "pointer-events-none opacity-30"
        }`}
        href={prevHref || "#"}
        prefetch={false}
        tabIndex={prevEnabled ? 0 : -1}
      >
        anterior
      </Link>
      <span className="text-neutral-400">página {page.toString().padStart(2, "0")}</span>
      <Link
        aria-disabled={!nextEnabled}
        className={`border border-neutral-800 px-3 py-2 transition-colors hover:border-neutral-500 hover:text-neutral-100 ${
          nextEnabled ? "" : "pointer-events-none opacity-30"
        }`}
        href={nextHref || "#"}
        prefetch={false}
        tabIndex={nextEnabled ? 0 : -1}
      >
        próxima
      </Link>
    </nav>
  );
}

