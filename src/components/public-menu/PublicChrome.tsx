"use client"

import { usePathname } from "next/navigation"
import { PublicMenu } from "./PublicMenu"

export function PublicHeader() {
  return <header data-public-header className="mx-auto flex w-full max-w-[36rem] items-center justify-end px-4 py-1 sm:w-[min(100%,34.5rem)] sm:max-w-[100vw]">
    <PublicMenu />
  </header>
}

export function PublicFooter({ year }: { year: number }) {
  if (usePathname() === "/links") return null
  return <footer className="mb-4 mt-12 text-center text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
    <p>© {year} domenyk.com</p>
    <p className="mt-1 break-all">bc1qfv788krszr8xz3uxvvzy33pp8jph0hw53557d4</p>
  </footer>
}
