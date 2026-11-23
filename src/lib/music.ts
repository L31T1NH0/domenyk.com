export type MusicTrack = { id: string; title: string; artist: string; cover: string; url: string; previewUrl: string; catalogUrl: string }
export type MusicStatus = { current: { track: MusicTrack; updatedAt: string } | null; top: { track: MusicTrack; plays: number }[] }
export type MusicQueueItem = { key: string; track: MusicTrack; current: boolean }

function https(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 2048) return false
  try { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password } catch { return false }
}
function appleURL(value: string): boolean {
  if (!https(value)) return false
  const host = new URL(value).hostname
  return ["apple.com", "mzstatic.com"].some(domain => host === domain || host.endsWith(`.${domain}`))
}
function track(value: unknown): MusicTrack {
  if (!value || typeof value !== "object") throw new Error("Faixa inválida")
  const item = value as Record<string, unknown>
  if (typeof item.id !== "string" || !/^[a-f\d]{64}$/.test(item.id) || typeof item.title !== "string" || !item.title.trim() || item.title.length > 1000 || typeof item.artist !== "string" || item.artist.length > 600) throw new Error("Faixa inválida")
  for (const key of ["cover", "url", "previewUrl", "catalogUrl"] as const) {
    if (typeof item[key] !== "string" || (item[key] !== "" && !https(item[key]))) throw new Error("Endereço inválido")
  }
  if ((item.previewUrl && !appleURL(item.previewUrl as string)) || (item.catalogUrl && !appleURL(item.catalogUrl as string)) || (item.previewUrl && !item.catalogUrl)) throw new Error("Catálogo inválido")
  return { id: item.id, title: item.title, artist: item.artist, cover: item.cover as string, url: item.url as string, previewUrl: item.previewUrl as string, catalogUrl: item.catalogUrl as string }
}
export function parseMusicStatus(value: unknown): MusicStatus {
  if (!value || typeof value !== "object") throw new Error("Música indisponível")
  const input = value as Record<string, unknown>
  if (!Array.isArray(input.top) || input.top.length > 15) throw new Error("Ranking inválido")
  let current: MusicStatus["current"] = null
  if (input.current !== null) {
    if (!input.current || typeof input.current !== "object") throw new Error("Faixa atual inválida")
    const item = input.current as Record<string, unknown>
    if (typeof item.updatedAt !== "string" || !Number.isFinite(Date.parse(item.updatedAt))) throw new Error("Data inválida")
    current = { track: track(item.track), updatedAt: item.updatedAt }
  }
  const top = input.top.map(item => {
    if (!item || !Number.isSafeInteger(item.plays) || item.plays < 1) throw new Error("Contagem inválida")
    return { track: track(item.track), plays: item.plays as number }
  })
  if (new Set(top.map(item => item.track.id)).size !== top.length) throw new Error("Faixas duplicadas")
  return { current, top }
}
export function musicQueue(status: MusicStatus, now = Date.now()): MusicQueueItem[] {
  const current = status.current && now - Date.parse(status.current.updatedAt) < 45_000 ? status.current : null
  return [
    ...(current ? [{ key: `current:${current.track.id}`, track: current.track, current: true }] : []),
    ...status.top.map(item => ({ key: `top:${item.track.id}`, track: item.track, current: false })),
  ]
}
export function nextMusicIndex(index: number, length: number, direction: number, shuffle: boolean, random = Math.random()): number {
  if (length < 2) return 0
  if (shuffle) return (index + 1 + Math.floor(Math.min(0.999999, Math.max(0, random)) * (length - 1))) % length
  return ((index + direction) % length + length) % length
}
export function musicTime(seconds: number): string {
  const value = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, "0")}`
}
