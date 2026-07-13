import { listMedia, serializeMediaItem } from "@/lib/blob"
import { MediaLibrary } from "./MediaLibrary"

export default async function AdminMediaPage() {
  const media = await listMedia()
  const serializedMedia = media.map(serializeMediaItem)

  return (
    <>
      <header className="admin-page-header"><div><h1>Mídia</h1><p>Envie e organize imagens usadas no conteúdo.</p></div></header>
      <MediaLibrary initialMedia={serializedMedia} />
    </>
  )
}
