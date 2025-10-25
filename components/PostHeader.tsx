"use client"

import Link from "next/link";
import Image from "next/image";
 

type PostHeaderProps = {
  cape?: string; // Link opcional para a imagem principal (capa)
  title: string; // Título do post
  friendImage?: string; // Link opcional para a foto do amigo
  coAuthorImageUrl?: string | null;
};

export function PostHeader({ cape, title, friendImage, coAuthorImageUrl }: PostHeaderProps) {
  console.log("Cape value in PostHeader:", cape); // Debug para verificar o valor de cape
  
  const secondaryImage = coAuthorImageUrl || friendImage || undefined;

  return (
    <div className="w-full relative">
      {cape && (
        <div className="w-full relative">
          <img src={cape} alt="Banner Principal" className="banner w-full h-auto" />
          <div className="absolute inset-0">
            <div className="absolute top-0 left-0 w-full h-[50%] bg-gradient-to-b from-[#040404] via-[#040404]/80 to-transparent"></div>
            <div className="absolute bottom-0 left-0 w-full h-[50%] bg-gradient-to-t from-[#040404] via-[#040404]/80 to-transparent"></div>
          </div>
          <div className="absolute bottom-1 left-2 lg:bottom-3 flex gap-2">
            <div className="flex -space-x-5">
              <Link href="/">
                <Image
                  priority
                  src="/images/profile.jpg"
                  className="foto-post hover:z-30 transition-all"
                  height={56}
                  width={56}
                  alt="Domenyk"
                />
              </Link>
              {secondaryImage && (
                <Link href="/">
                  <Image
                    priority
                    src={secondaryImage}
                    className="foto-post hover:z-30 transition-all"
                    height={56}
                    width={56}
                    alt="Amigo"
                  />
                </Link>
              )}
            </div>
            <h1 className="text-xl text-white flex-1">{title}</h1>
          </div>
        </div>
      )}
      {!cape && (
        <div className="flex flex-col gap-4 items-center">
          <div className="flex -space-x-4">
            <Link href="/">
              <Image
                priority
                src="/images/profile.jpg"
                className="rounded-full brightness-125 foto"
                height={148}
                width={148}
                alt="Domenyk"
              />
            </Link>
            {secondaryImage && (
              <Link href="/">
                <Image
                  priority
                  src={secondaryImage}
                  className="rounded-full brightness-125 foto"
                  height={148}
                  width={148}
                  alt="Amigo"
                />
              </Link>
            )}
          </div>
          <h1 className=" ">{title}</h1>
        </div>
      )}
    </div>
  );
}
