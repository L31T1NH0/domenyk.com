const ready = chrome.storage.session.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" })
let queue = Promise.resolve()

async function configuration() {
  const response = await fetch(chrome.runtime.getURL("config.json"))
  if (!response.ok) throw new Error("Execute o setup da extensão")
  const config = await response.json()
  if (!["https://domenyk-api.vercel.app", "http://localhost:8080"].includes(config.apiOrigin) || !/^[a-f0-9]{64}$/.test(config.token)) throw new Error("Configuração inválida")
  return config
}

function snapshotFrom(message, sender) {
  if (sender.id !== chrome.runtime.id || sender.frameId !== 0 || !Number.isInteger(sender.tab?.id) || !sender.url?.startsWith("https://www.netflix.com/")) throw new Error("Origem inválida")
  if (message.snapshot === null) return null
  const data = message.snapshot
  const match = /^https:\/\/www\.netflix\.com\/watch\/(\d+)(?:[?#]|$)/.exec(sender.url)
  if (!data || !match || data.url !== `https://www.netflix.com/watch/${match[1]}` || typeof data.title !== "string" || !data.title.trim() || [...data.title].length > 500 || typeof data.episode !== "string" || [...data.episode].length > 300 || typeof data.playing !== "boolean" || typeof data.cover !== "string" || data.cover.length > 2048) throw new Error("Vídeo inválido")
  if (data.cover) {
    const cover = new URL(data.cover)
    if (cover.protocol !== "https:" || cover.username || cover.password || cover.port || !/(^|\.)nflx(?:img|so)\.net$/.test(cover.hostname)) throw new Error("Capa inválida")
  }
  return { title: data.title.trim(), episode: data.episode.trim(), cover: data.cover, url: data.url, playing: data.playing }
}

async function publish(tabId, snapshot) {
  await ready
  const { current } = await chrome.storage.session.get("current")
  if (!snapshot?.playing && (!current || current.tabId !== tabId || (snapshot && current.url !== snapshot.url))) return
  const same = current?.tabId === tabId && (!snapshot || current.url === snapshot.url)
  const data = snapshot || { ...current, playing: false }
  const sessionId = same ? current.sessionId : [...crypto.getRandomValues(new Uint8Array(32))].map(byte => byte.toString(16).padStart(2, "0")).join("")
  const event = { sessionId, sequence: same ? current.sequence + 1 : 1, observedAt: new Date().toISOString(), title: data.title, episode: data.episode, cover: data.cover, url: data.url, playing: data.playing }
  // Persist before networking so a suspended worker preserves session ordering.
  await chrome.storage.session.set({ current: { ...event, tabId } })
  const config = await configuration()
  const response = await fetch(`${config.apiOrigin}/v1/watching/events`, {
    method: "POST", credentials: "omit", redirect: "error", cache: "no-store", signal: AbortSignal.timeout(8000),
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.token}`, ...(config.protectionBypass ? { "x-vercel-protection-bypass": config.protectionBypass } : {}) },
    body: JSON.stringify(event)
  })
  if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) throw new Error(`Falha no envio (${response.status})`)
  const result = await response.json()
  if (result.ok !== true) throw new Error("Resposta inválida da API")
  await chrome.action.setBadgeText({ text: event.playing ? "ON" : "" })
  await chrome.action.setTitle({ title: event.playing ? `Assistindo: ${event.title}` : "Domenyk · Assistindo agora" })
}

function enqueue(task) {
  const result = queue.then(task)
  queue = result.catch(async () => {
    await chrome.action.setBadgeText({ text: "!" })
    await chrome.action.setTitle({ title: "Não foi possível atualizar. Confira config.json e a API." })
  })
  return result
}

// Register listeners synchronously so they wake a suspended Manifest V3 worker.
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (message?.type !== "netflix-playback") return
  let snapshot
  try { snapshot = snapshotFrom(message, sender) } catch { respond({ ok: false }); return }
  enqueue(() => publish(sender.tab.id, snapshot)).then(() => respond({ ok: true }), () => respond({ ok: false }))
  return true
})
chrome.tabs.onRemoved.addListener(tabId => { void enqueue(() => publish(tabId, null)).catch(() => {}) })
chrome.tabs.onUpdated.addListener((tabId, changes) => {
  if (changes.url && !/^https:\/\/www\.netflix\.com\/watch\/\d+(?:[?#]|$)/.test(changes.url)) void enqueue(() => publish(tabId, null)).catch(() => {})
})
chrome.action.onClicked.addListener(() => { chrome.tabs.create({ url: "https://domenyk.com/links" }) })
