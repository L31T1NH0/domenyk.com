(() => {
  let previous = null
  let signature = ""
  let sentAt = 0
  let running = true
  let timer

  function sample() {
    if (!running) return
    const snapshot = globalThis.NetflixWatching.read(document, location.href, navigator.mediaSession?.metadata, previous)
    if (snapshot) previous = snapshot
    const next = JSON.stringify(snapshot)
    if (next !== signature || Date.now() - sentAt >= 15_000) {
      signature = next
      sentAt = Date.now()
      chrome.runtime.sendMessage({ type: "netflix-playback", snapshot }).catch(() => {
        // A reloaded/removed extension invalidates this content script.
        if (!chrome.runtime.id) { running = false; clearTimeout(timer) }
      })
    }
  }
  function tick() {
    sample()
    if (running) timer = setTimeout(tick, 5000)
  }
  // Media events are captured because they do not bubble.
  for (const event of ["playing", "pause", "ended", "waiting", "emptied", "loadedmetadata"]) document.addEventListener(event, sample, true)
  window.addEventListener("pagehide", () => {
    chrome.runtime.sendMessage({ type: "netflix-playback", snapshot: null }).catch(() => {})
  })
  tick()
})()
