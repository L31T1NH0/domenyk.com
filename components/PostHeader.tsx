"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";

type PostHeaderProps = {
  cape?: string; // Link opcional para a imagem principal (capa)
  title: string; // Título do post
  subtitle?: string; // Subtítulo opcional
  friendImage?: string; // Link opcional para a foto do amigo
  coAuthorImageUrl?: string | null;
  titleSlot?: ReactNode;
  subtitleSlot?: ReactNode;
  disableProfileLinks?: boolean;
  overlaySlot?: ReactNode;
};

export function PostHeader({
  cape,
  title,
  subtitle,
  friendImage,
  coAuthorImageUrl,
  titleSlot,
  subtitleSlot,
  disableProfileLinks = false,
  overlaySlot,
}: PostHeaderProps) {
  const secondaryImage = coAuthorImageUrl || friendImage || undefined;

  const AvatarWrapper = ({ children }: { children: ReactNode }) => {
    if (disableProfileLinks) {
      return <div className="pointer-events-none">{children}</div>;
    }

    return <Link href="/">{children}</Link>;
  };

  return (
    <div className="w-full relative">
      {overlaySlot}
      {cape && (
        <div className="w-full relative">
          <Image
            src={cape}
            alt="Banner Principal"
            width={1920}
            height={1080}
            className="banner w-full h-auto object-cover"
            priority
          />
          <div className="absolute inset-0">
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute top-0 left-0 w-full h-[50%] bg-gradient-to-b from-[#040404] via-[#040404]/80 to-transparent"></div>
              <div className="absolute bottom-0 left-0 w-full h-[50%] bg-gradient-to-t from-[#040404] via-[#040404]/80 to-transparent"></div>
            </div>
            <div className="absolute bottom-1 left-2 lg:bottom-3 flex flex-col gap-2">
              <div className="flex -space-x-5">
                <AvatarWrapper>
                  <Image
                    priority
                    src="/images/profile.jpg"
                    className="foto-post hover:z-30 transition-all"
                    height={56}
                    width={56}
                    alt="Domenyk"
                  />
                </AvatarWrapper>
                {secondaryImage && (
                  <AvatarWrapper>
                    <Image
                      src={secondaryImage}
                      className="foto-post hover:z-30 transition-all"
                      height={56}
                      width={56}
                      alt="Amigo"
                    />
                  </AvatarWrapper>
                )}
              </div>
              {titleSlot ?? <h1 className="text-xl text-white">{title}</h1>}
              {subtitleSlot ?? (subtitle ? <p className="text-sm text-zinc-200 drop-shadow">{subtitle}</p> : null)}
            </div>
          </div>
        </div>
      )}
      {!cape && (
        <div className="flex flex-col gap-4 items-center">
          <div className="flex -space-x-4">
            <AvatarWrapper>
              <Image
                priority
                src="/images/profile.jpg"
                className="rounded-full brightness-125 foto"
                height={148}
                width={148}
                alt="Domenyk"
              />
            </AvatarWrapper>
            {secondaryImage && (
              <AvatarWrapper>
                <Image
                  src={secondaryImage}
                  className="rounded-full brightness-125 foto"
                  height={148}
                  width={148}
                  alt="Amigo"
                />
              </AvatarWrapper>
            )}
          </div>
          {titleSlot ?? <h1 className=" ">{title}</h1>}
          {subtitleSlot ?? (subtitle ? <p className="text-sm text-zinc-300 text-center">{subtitle}</p> : null)}
        </div>
      )}
    </div>
  );
}
