"use client";

import Link from "next/link";
import { ChevronLeftIcon } from "@heroicons/react/24/outline";

export function BackHome() {
  return (
    <>
      {/* Mobile: inline */}
      <div className="md:hidden my-6 mx-0">
        <Link
          href="/"
          className="inline-flex w-fit h-fit items-center gap-2 py-1 text-zinc-600 hover:text-zinc-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:text-zinc-300 dark:hover:text-zinc-100 mx-0"
          aria-label="Voltar para a página inicial"
          title="Voltar para a página inicial"
        >
          <ChevronLeftIcon className="size-5" aria-hidden="true" />
          <span className="text-sm">Voltar</span>
        </Link>
      </div>

      {/* Desktop: fixo, fora do container */}
      <Link
        href="/"
        className="hidden md:flex absolute left-0 top-1/2 -translate-x-full -translate-y-1/2 -ml-4 z-40 items-center justify-center p-1.5 rounded-full text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors transition-transform duration-150 hover:scale-110"
        aria-label="Voltar para a página inicial"
        title="Voltar para a página inicial"
      >
        <ChevronLeftIcon className="size-7 text-zinc-700 dark:text-zinc-300" aria-hidden="true" />
      </Link>
    </>
  );
}
