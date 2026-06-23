import Image from "next/image"
import Link from "next/link"
import { AutoFitText } from "@/components/text/AutoFitText"

type Props = {
  title: string
  subtitle?: string
  cover?: { url: string; alt?: string }
  secondaryImage?: string | null
  background?: { color?: string; imageUrl?: string }
}

function Avatar({
  src,
  alt,
  size,
}: {
  src: string
  alt: string
  size: "post" | "large"
}) {
  const isProfileImage = src === "/images/profile.jpg"

  return (
    <Link href="/">
      <Image
        priority={src === "/images/profile.jpg"}
        src={src}
        height={size === "post" ? 48 : 112}
        width={size === "post" ? 48 : 112}
        alt={alt}
        className={[
          "!rounded-full hover:z-30 hover:opacity-90 transition-all object-cover",
          isProfileImage ? "!grayscale !brightness-125" : "",
          size === "post" ? "size-9" : "size-28",
        ].join(" ")}
      />
    </Link>
  )
}

export function PostHeader({ title, subtitle, cover, secondaryImage, background }: Props) {
  if (cover?.url) {
    return (
      <div className="relative w-full">
        <Image
          src={cover.url}
          alt={cover.alt ?? title}
          width={1920}
          height={1080}
          className="banner h-auto w-full rounded-xl object-cover"
          style={{ filter: "none" }}
          priority
        />
        <div className="pointer-events-none absolute inset-0 rounded-xl">
          <div className="absolute left-0 top-0 h-[42%] w-full bg-gradient-to-b from-[#040404]/85 via-[#040404]/55 to-transparent" />
          <div className="absolute bottom-0 left-0 h-[58%] w-full bg-gradient-to-t from-[#040404]/90 via-[#040404]/58 to-transparent" />
        </div>
        <div className="absolute bottom-2 left-3 right-3 flex flex-col gap-2 sm:bottom-3">
          <div className="flex -space-x-5">
            <Avatar src="/images/profile.jpg" alt="Domenyk" size="post" />
            {secondaryImage && <Avatar src={secondaryImage} alt="Coautor" size="post" />}
          </div>
          <AutoFitText as="h1" text={title} minSize={14} maxSize={19} maxLines={2} className="text-white" />
          {subtitle && (
            <AutoFitText
              as="p"
              text={subtitle}
              minSize={10}
              maxSize={12}
              maxLines={2}
              className="text-zinc-300 drop-shadow"
            />
          )}
        </div>
      </div>
    )
  }

  return (
    <div
      className="flex flex-col items-center gap-2 pb-3 pt-1"
      style={{ backgroundColor: background?.color }}
    >
      <div className="flex -space-x-4">
        <Avatar src="/images/profile.jpg" alt="Domenyk" size="large" />
        {secondaryImage && <Avatar src={secondaryImage} alt="Coautor" size="large" />}
      </div>
      <AutoFitText
        as="h1"
        text={title}
        minSize={16}
        maxSize={18}
        maxLines={3}
        className="w-full text-center text-neutral-950 dark:text-[#f1f1f1]"
      />
      {subtitle && (
        <AutoFitText
          as="p"
          text={subtitle}
          minSize={12}
          maxSize={14}
          maxLines={3}
          className="w-full text-center text-neutral-600 dark:text-zinc-300"
        />
      )}
    </div>
  )
}
