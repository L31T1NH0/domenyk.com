"use client";

import Link from "next/link";
import Image from "next/image";
 

type HeaderProps = {
  home?: boolean;
};

const name = "Domenyk";

export function Header({ home }: HeaderProps) {
  

  return (
    <header className="flex flex-col items-center gap-5 py-10">
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
          <div className="flex flex-col items-center gap-1.5">
            <strong className="text-2xl font-semibold tracking-tight text-[#f1f1f1]">
              {name}
            </strong>
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-[#A8A095]">
              Blog
            </span>
          </div>
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
          <div className="flex flex-col items-center gap-1.5">
            <strong className="text-2xl font-semibold tracking-tight text-[#f1f1f1]">
              {name}
            </strong>
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-[#A8A095]">
              Blog
            </span>
          </div>
        </>
      )}
    </header>
  );
}
