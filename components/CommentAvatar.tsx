"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

import { generateIdenticon } from "./comments/utils";

type CommentAvatarProps = {
  imageUrl?: string | null;
  name: string;
  seed?: string;
  size?: number;
  className?: string;
};

const DEFAULT_BLUR_DATA_URL =
  "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0nMicgaGVpZ2h0PScyJyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnPjxyZWN0IHdpZHRoPScyJyBoZWlnaHQ9JzInIGZpbGw9JyNFMEUwRTAnIC8+PC9zdmc+";

export default function CommentAvatar({
  imageUrl,
  name,
  seed,
  size = 40,
  className,
}: CommentAvatarProps) {
  const fallbackSrc = useMemo(
    () => generateIdenticon(name, seed ?? ""),
    [name, seed]
  );

  const [hasError, setHasError] = useState(false);
  const [currentSrc, setCurrentSrc] = useState<string>(
    imageUrl ?? fallbackSrc
  );

  useEffect(() => {
    setHasError(false);
    setCurrentSrc(imageUrl ?? fallbackSrc);
  }, [imageUrl, fallbackSrc]);

  return (
    <Image
      src={currentSrc}
      alt={`Avatar de ${name}`}
      width={size}
      height={size}
      className={`rounded-full object-cover ${className ?? ""}`.trim()}
      placeholder="blur"
      blurDataURL={DEFAULT_BLUR_DATA_URL}
      onError={() => {
        if (hasError) {
          return;
        }
        console.debug("CommentAvatar: fallback to identicon", {
          name,
          seed,
          imageUrl,
        });
        setHasError(true);
        setCurrentSrc(fallbackSrc);
      }}
    />
  );
}
