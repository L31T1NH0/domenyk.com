import Image from "next/image"
import Link from "next/link"

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
  return (
    <Link href="/">
      <Image
        priority={src === "/images/profile.jpg"}
        src={src}
        height={size === "post" ? 56 : 148}
        width={size === "post" ? 56 : 148}
        alt={alt}
        className={[
          "!rounded-full brightness-125 hover:z-30 hover:opacity-90 transition-all object-cover",
          size === "post" ? "w-10 h-10" : "w-[148px] h-[148px]",
        ].join(" ")}
        style={{ filter: "none" }}
      />
    </Link>
  )
}

export function PostHeader({ title, subtitle, cover, secondaryImage, background }: Props) {
  if (cover?.url) {
    return (
      <div className="w-full relative">
        <Image
          src={cover.url}
          alt={cover.alt ?? title}
          width={1920}
          height={1080}
          className="banner w-full h-auto rounded-2xl object-cover"
          style={{ filter: "none" }}
          priority
        />
        <div className="absolute inset-0 rounded-2xl pointer-events-none">
          <div className="absolute top-0 left-0 w-full h-[50%] bg-gradient-to-b from-[#040404] via-[#040404]/80 to-transparent" />
          <div className="absolute bottom-0 left-0 w-full h-[50%] bg-gradient-to-t from-[#040404] via-[#040404]/80 to-transparent" />
        </div>
        <div className="absolute bottom-1 left-2 lg:bottom-3 flex flex-col gap-2">
          <div className="flex -space-x-5">
            <Avatar src="/images/profile.jpg" alt="Domenyk" size="post" />
            {secondaryImage && <Avatar src={secondaryImage} alt="Coautor" size="post" />}
          </div>
          <h1 className="text-xl text-white">{title}</h1>
          {subtitle && <p className="text-xs text-zinc-300 drop-shadow">{subtitle}</p>}
        </div>
      </div>
    )
  }

  return (
    <div
      className="flex flex-col gap-2 items-center pb-2"
      style={{ backgroundColor: background?.color }}
    >
      <div className="flex -space-x-4">
        <Avatar src="/images/profile.jpg" alt="Domenyk" size="large" />
        {secondaryImage && <Avatar src={secondaryImage} alt="Coautor" size="large" />}
      </div>
      <h1 className="text-[#f1f1f1] text-center">{title}</h1>
      {subtitle && <p className="text-sm text-zinc-300 text-center">{subtitle}</p>}
    </div>
  )
}
