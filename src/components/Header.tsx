"use client"

import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"

const name = "Domenyk"

export function Header() {
  const pathname = usePathname()
  const isAbout = pathname === "/sobre"

  return (
    <header className="flex flex-col items-center gap-4 pb-2">
      {isAbout ? (
        <>
          <Link href="/">
            <Image
              priority
              src="/images/profile.jpg"
              className="!rounded-full !grayscale !brightness-125 transition-opacity hover:opacity-80"
              height={148}
              width={148}
              alt={name}
            />
          </Link>
          <strong className="text-2xl font-semibold tracking-tight text-neutral-950 dark:text-[#f1f1f1]">
            {name}
          </strong>
        </>
      ) : (
        <Link href="/" className="transition-opacity hover:opacity-80">
          <strong className="text-2xl font-semibold tracking-tight text-neutral-950 dark:text-[#f1f1f1]">
            {name}
          </strong>
        </Link>
      )}
    </header>
  )
}
