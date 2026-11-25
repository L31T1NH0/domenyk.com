export type WatchingVideo = { title: string; episode: string; cover: string; url: string }
export type WatchingStatus = { current: { video: WatchingVideo; updatedAt: string } | null }

export function parseWatchingStatus(value: unknown): WatchingStatus {
  if (!value || typeof value !== "object") throw new Error("Reprodução indisponível")
  const input = value as Record<string, unknown>
  if (input.current === null) return { current: null }
  if (!input.current || typeof input.current !== "object") throw new Error("Reprodução inválida")
  const current = input.current as Record<string, unknown>
  if (typeof current.updatedAt !== "string" || !Number.isFinite(Date.parse(current.updatedAt)) || !current.video || typeof current.video !== "object") throw new Error("Reprodução inválida")
  const video = current.video as Record<string, unknown>
  if (typeof video.title !== "string" || !video.title.trim() || [...video.title].length > 500 || typeof video.episode !== "string" || [...video.episode].length > 300 || typeof video.cover !== "string" || video.cover.length > 2048 || typeof video.url !== "string" || !/^https:\/\/www\.netflix\.com\/watch\/\d+$/.test(video.url)) throw new Error("Vídeo inválido")
  if (video.cover) {
    const cover = new URL(video.cover)
    const netflixCover = /(^|\.)nflx(?:img|so)\.net$/.test(cover.hostname)
    const tvmazeCover = cover.hostname === "static.tvmaze.com" && cover.pathname.startsWith("/uploads/images/") && !cover.search && !cover.hash
    if (cover.protocol !== "https:" || cover.username || cover.password || cover.port || (!netflixCover && !tvmazeCover)) throw new Error("Capa inválida")
  }
  return { current: { video: { title: video.title, episode: video.episode, cover: video.cover, url: video.url }, updatedAt: current.updatedAt } }
}

export function currentWatching(status: WatchingStatus, now = Date.now()): WatchingVideo | null {
  if (!status.current) return null
  const age = now - Date.parse(status.current.updatedAt)
  return age >= -30_000 && age < 45_000 ? status.current.video : null
}
