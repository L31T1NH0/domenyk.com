// Only metadata about the current player is read; no account, cookies or history.
globalThis.NetflixWatching = {
  read(document, href, metadata, previous) {
    const match = /^https:\/\/www\.netflix\.com\/watch\/(\d+)(?:[?#]|$)/.exec(href)
    if (!match) return null
    const url = `https://www.netflix.com/watch/${match[1]}`
    const cached = previous?.url === url ? previous : null
    const video = document.querySelector(".watch-video video, video")
    if (!video) return null
    const text = selector => document.querySelector(selector)?.textContent?.replace(/\s+/g, " ").trim() || ""
    const title = text('[data-uia="video-title"] h4, .video-title h4, .ellipsize-text h4') || text('[data-uia="video-title"]') || cached?.title || metadata?.album || metadata?.title || ""
    if (!title || title.toLowerCase() === "netflix") return null
    const episode = [...document.querySelectorAll(".ellipsize-text > span, .video-title > span")].map(node => node.textContent?.trim()).filter(Boolean).join(" · ") || cached?.episode || ""
    const candidate = video.poster || metadata?.artwork?.at(-1)?.src || cached?.cover || ""
    let cover = ""
    try {
      const image = new URL(candidate)
      if (image.protocol === "https:" && !image.username && !image.password && !image.port && /(^|\.)nflx(?:img|so)\.net$/.test(image.hostname) && candidate.length <= 2048) cover = image.href
    } catch { /* Missing artwork uses the site's video icon. */ }
    return { title: [...title].slice(0, 500).join(""), episode: [...episode].slice(0, 300).join(""), cover, url, playing: !video.paused && !video.ended && video.readyState >= 3 }
  }
}
