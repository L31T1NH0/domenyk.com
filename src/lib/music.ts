export type MusicTrack = { id: string; title: string; artist: string; cover: string }
export type MusicStatus = { current: { track: MusicTrack; updatedAt: string } | null }

export function parseMusicStatus(value: unknown): MusicStatus {
  if (!value || typeof value !== "object") throw new Error("Música indisponível")
  const input = value as Record<string, unknown>
  if (input.current === null) return { current: null }
  if (!input.current || typeof input.current !== "object") throw new Error("Faixa atual inválida")
  const current = input.current as Record<string, unknown>
  if (typeof current.updatedAt !== "string" || !Number.isFinite(Date.parse(current.updatedAt))) throw new Error("Data inválida")
  if (!current.track || typeof current.track !== "object") throw new Error("Faixa inválida")
  const track = current.track as Record<string, unknown>
  if (typeof track.id !== "string" || !/^[a-f\d]{64}$/.test(track.id) || typeof track.title !== "string" || !track.title.trim() || track.title.length > 1000 || typeof track.artist !== "string" || track.artist.length > 600 || typeof track.cover !== "string" || track.cover.length > 2048) throw new Error("Faixa inválida")
  if (track.cover) {
    const cover = new URL(track.cover)
    if (cover.protocol !== "https:" || cover.username || cover.password) throw new Error("Capa inválida")
  }
  return { current: { track: { id: track.id, title: track.title, artist: track.artist, cover: track.cover }, updatedAt: current.updatedAt } }
}
export function currentMusic(status: MusicStatus, now = Date.now()): MusicTrack | null {
  return status.current && now - Date.parse(status.current.updatedAt) < 45_000 ? status.current.track : null
}
export function youtubeMusicSearch(title: string): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(title)}`
}
