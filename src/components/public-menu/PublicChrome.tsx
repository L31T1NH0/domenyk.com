"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { PublicMenu } from "./PublicMenu"

export function PublicHeader() {
  const isLinks = usePathname() === "/links"

  return (
    <header className={`mx-auto flex w-full max-w-[36rem] items-center px-4 sm:w-[min(100%,34.5rem)] sm:max-w-[100vw] ${isLinks ? "justify-between pb-5 pt-6 [&_.public-menu-position]:!translate-x-0" : "justify-end py-1"}`}>
      {isLinks && (
        <div className="text-xl tracking-tight text-neutral-950 dark:text-neutral-100">
          <Link href="/" className="rounded-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-4">domenyk</Link>
          <span className="font-normal text-neutral-500 dark:text-neutral-400"> / links</span>
        </div>
      )}
      <PublicMenu />
    </header>
  )
}

export function PublicFooter({ year }: { year: number }) {
  const isLinks = usePathname() === "/links"

  return (
    <footer className={`mb-4 mt-12 text-center text-xs leading-relaxed text-zinc-600 dark:text-zinc-400 ${isLinks ? "border-t border-neutral-200 pt-5 dark:border-white/10" : ""}`}>
      <p>© {year} domenyk.com</p>
      {!isLinks && <p className="mt-1 break-all">bc1qfv788krszr8xz3uxvvzy33pp8jph0hw53557d4</p>}
    </footer>
  )
}
