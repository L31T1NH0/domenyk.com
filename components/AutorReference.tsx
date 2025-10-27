"use client";

import Image from "next/image";

type AutorReferenceProps = {
  kind: "author" | "co-author";
  coAuthorImageUrl?: string | null;
};

export default function AutorReference({ kind, coAuthorImageUrl }: AutorReferenceProps) {
  const src = kind === "author" ? "/images/profile.jpg" : coAuthorImageUrl ?? null;

  if (!src) {
    return (
      <span
        data-role="author-reference"
        data-kind={kind}
        className="inline-flex items-center justify-center rounded-full bg-zinc-800/60"
      />
    );
  }

  return (
    <span data-role="author-reference" data-kind={kind} className="inline-flex items-center">
      <Image
        src={src}
        alt=""
        height={56}
        width={56}
        className="svg-icon rounded-full"
        priority={false}
      />
    </span>
  );
}

