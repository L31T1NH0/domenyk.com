import { listMedia, serializeMediaItem } from "@/lib/blob"
import { MediaLibrary } from "./MediaLibrary"

export default async function AdminMediaPage() {
  const media = await listMedia()
  const serializedMedia = media.map(serializeMediaItem)

  return (
    <>
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-400">Assets</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Media</h1>
      </div>
      <MediaLibrary initialMedia={serializedMedia} />
    </>
  )
}
