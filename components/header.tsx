"use client";

import Link from "next/link";
import Image from "next/image";
 

type HeaderProps = {
  home?: boolean;
};

const name = "Domenyk";

export function Header({ home }: HeaderProps) {
  

  return (
    <header className="flex flex-col items-center gap-4 pt-6 pb-2">
      {home ? (
        <>
          <Image
            priority
            src="/images/profile.jpg"
            className="rounded-full brightness-110 foto"
            height={148}
            width={148}
            alt={name}
          />
          <strong className="text-2xl font-semibold tracking-tight text-[#f1f1f1]">
            {name}
          </strong>
        </>
      ) : (
        <>
          <Link href="/">
            <Image
              priority
              src="/images/profile.jpg"
              className="rounded-full brightness-110 foto transition-opacity hover:opacity-80"
              height={148}
              width={148}
              alt={name}
            />
          </Link>
          <strong className="text-2xl font-semibold tracking-tight text-[#f1f1f1]">
            {name}
          </strong>
        </>
      )}
    </header>
  );
}
