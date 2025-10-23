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

  const nextNumber = nextEnabled ? page + 1 : undefined;

  return (
    <div className="flex items-center justify-center gap-3 mt-8">
      <Link aria-disabled={!prevEnabled} className={`rounded-full px-4 py-2 border shadow-sm hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 ease-in-out ${!prevEnabled ? "pointer-events-none" : ""}`} href={prevHref || "#"} prefetch={false} tabIndex={prevEnabled ? 0 : -1}><ChevronLeftIcon className="h-4 w-4" /></Link>
      <span className="text-sm md:text-base font-medium">
        {page} / {nextEnabled ? page + 1 : "—"}
      </span>
      <Link aria-disabled={!nextEnabled} className={`rounded-full px-4 py-2 border shadow-sm hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 ease-in-out ${!nextEnabled ? "pointer-events-none" : ""}`} href={nextHref || "#"} prefetch={false} tabIndex={nextEnabled ? 0 : -1}><ChevronRightIcon className="h-4 w-4" /></Link>
    </div>
  );
}
















