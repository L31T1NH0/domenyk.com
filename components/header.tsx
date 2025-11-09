"use client";

import Link from "next/link";
import Image from "next/image";
 

type HeaderProps = {
  home?: boolean;
};

const name = "Domenyk";

export function Header({ home }: HeaderProps) {
  

  return (
    <header className="flex flex-col items-center gap-4 text-zinc-900 dark:text-zinc-100">
      {home ? (
        <>
          <Image
            priority
            src="/images/profile.jpg"
            className="rounded-full brightness-125 foto"
            height={148}
            width={148}
            alt={name}
          />
          <strong className="text-3xl text-inherit">{name}</strong>
        </>
      ) : (
        <>
          <Link href="/" legacyBehavior>
            <Image
              priority
              src="/images/profile.jpg"
              className="rounded-full brightness-125 foto"
              height={148}
              width={148}
              alt={name}
            />
          </Link>
          <strong className="text-3xl text-inherit">Domenyk</strong>
        </>
      )}
    </header>
  );
}
