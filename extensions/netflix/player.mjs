// Serialized by chrome.scripting into MAIN. Never pass credentials or closures here.
export async function readNetflixPlayer() {
  const route = /^\/watch\/(\d+)(?:\/|$)/.exec(location.pathname)
  if (location.origin !== "https://www.netflix.com" || !route) return null
  const video = document.querySelector(".watch-video video, video")
  let playback
  try {
    const sessions = globalThis.netflix?.appContext?.state?.playerApp?.getState()?.videoPlayer?.playbackStateBySessionId
    const entries = Object.values(sessions || {}).filter(item => item && item.duration > 0)
    playback = entries.find(item => item.playing && !item.paused) || entries.find(item => String(item.videoId) === route[1])
  } catch { /* DOM and Media Session remain available when Netflix changes its player. */ }
  if (!video && !playback) return null
  const id = String(playback?.videoId || route[1])
  const clean = (value, limit) => typeof value === "string" ? [...value.replace(/\s+/g, " ").trim()].slice(0, limit).join("") : ""
  const text = selector => clean(document.querySelector(selector)?.textContent, 500)
  const media = navigator.mediaSession?.metadata
  let cached = globalThis.__domenykWatchingMetadata
  if (cached?.id !== id) cached = null
  if (!cached || cached.retryAt <= Date.now()) {
    const signal = AbortSignal.timeout(2500)
    const bases = ["/nq/website/memberapi/release"]
    const build = globalThis.netflix?.reactContext?.models?.serverDefs?.data?.BUILD_IDENTIFIER
    if (typeof build === "string" && /^[a-z\d._-]{1,120}$/i.test(build)) bases.push(`/nq/website/memberapi/${build}`)
    let metadata
    for (const base of bases) {
      try {
        const url = new URL(`${base}/metadata`, location.origin)
        url.searchParams.set("movieid", id)
        url.searchParams.set("languages", "en-US")
        const response = await fetch(url, { credentials: "same-origin", redirect: "error", signal })
        if (!response.ok) continue
        const item = (await response.json()).video
        if (!item || typeof item.title !== "string" || !item.title.trim()) continue
        let episode = ""
        for (const season of item.seasons || []) {
          const current = season.episodes?.find(entry => String(entry.id) === id)
          if (current) {
            const numbers = !item.hiddenEpisodeNumbers && Number.isInteger(season.seq) && Number.isInteger(current.seq) ? `T${season.seq}:E${current.seq}` : ""
            episode = [numbers, clean(current.title, 300)].filter(Boolean).join(" · ")
            break
          }
        }
        metadata = { title: clean(item.title, 500), episode: clean(episode, 300), cover: item.artwork?.[0]?.url || "" }
        break
      } catch { /* Only the current title's metadata is requested; no viewing history. */ }
    }
    cached = { id, title: metadata?.title || cached?.title || "", episode: metadata?.episode || cached?.episode || "", cover: metadata?.cover || cached?.cover || "", retryAt: Date.now() + (metadata ? 3_600_000 : 30_000) }
    globalThis.__domenykWatchingMetadata = cached
  }
  const mediaTitle = [media?.album, media?.title].map(value => clean(value, 500)).find(value => value && value.toLowerCase() !== "netflix")
  const title = cached.title || text('[data-uia="video-title"] h4, [data-uia="player-title"] h4, .video-title h4, .ellipsize-text h4') || text('[data-uia="video-title"], [data-uia="player-title"], .video-title > :first-child, .ellipsize-text > :first-child') || mediaTitle
  if (!title || title.toLowerCase() === "netflix") return null
  const episode = cached.episode || [...document.querySelectorAll(".ellipsize-text > span, .video-title > span")].map(item => clean(item.textContent, 300)).filter(Boolean).join(" · ")
  const candidate = cached.cover || video?.poster || media?.artwork?.at(-1)?.src || ""
  let cover = ""
  try {
    const image = new URL(candidate)
    if (image.protocol === "https:" && !image.username && !image.password && !image.port && /(^|\.)nflx(?:img|so)\.net$/.test(image.hostname) && candidate.length <= 2048) cover = image.href
  } catch { /* The Go API can supply TVmaze artwork when Netflix has none. */ }
  // The API's playing flag represents presence in the episode, including pauses.
  const ended = playback && Number.isFinite(playback.currentTime) ? playback.currentTime >= playback.duration : video?.ended
  const playing = !ended
  return { title, episode: clean(episode, 300), cover, url: `https://www.netflix.com/watch/${route[1]}`, playing }
}
