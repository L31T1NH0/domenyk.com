(() => {
  globalThis.__domenykWatchingReporter?.stop?.()
  let previous = null
  let signature = ""
  let sentAt = 0
  let running = true
  let timer

  function sample(event) {
    if (!running) return
    let snapshot = null
    try { snapshot = globalThis.NetflixWatching.read(document, location.href, navigator.mediaSession?.metadata, previous) } catch { /* The MAIN-world probe can still recognize the player. */ }
    if (snapshot) previous = snapshot
    const next = JSON.stringify(snapshot)
    if (event || next !== signature || Date.now() - sentAt >= 15_000) {
      signature = next
      sentAt = Date.now()
      try {
        chrome.runtime.sendMessage({ type: "netflix-playback", snapshot }).catch(() => {
          if (!chrome.runtime.id) stop()
        })
      } catch { stop() }
    }
  }
  function tick() {
    sample()
    if (running) timer = setTimeout(tick, 5000)
  }
  // Media events are captured because they do not bubble.
  const events = ["playing", "pause", "ended", "waiting", "emptied", "loadedmetadata"]
  for (const event of events) document.addEventListener(event, sample, true)
  function leaving() {
    chrome.runtime.sendMessage({ type: "netflix-playback", snapshot: null, leaving: true }).catch(() => {})
  }
  function stop() {
    running = false
    clearTimeout(timer)
    for (const event of events) document.removeEventListener(event, sample, true)
    window.removeEventListener("pagehide", leaving)
  }
  window.addEventListener("pagehide", leaving)
  globalThis.__domenykWatchingReporter = { stop }
  tick()
})()
