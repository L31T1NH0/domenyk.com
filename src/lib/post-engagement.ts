const LATEST_ENGAGEMENT_KEY = "domenyk:latest-post-engagement"

type Engagement = {
  token: string
  publicId: string
  path: string
  at: number
}

function engagementKey(publicId: string) {
  return `domenyk:post-engagement:${publicId}`
}

function readEngagement(value: string | null): Engagement | null {
  try {
    const engagement = JSON.parse(value ?? "null") as Engagement | null
    if (!engagement?.token || Date.now() - engagement.at > 4 * 60 * 60_000) return null
    return engagement
  } catch {
    return null
  }
}

export function setPostEngagement(publicId: string, token: string) {
  const engagement: Engagement = { token, publicId, path: window.location.pathname, at: Date.now() }
  try {
    sessionStorage.setItem(engagementKey(publicId), JSON.stringify(engagement))
    sessionStorage.setItem(LATEST_ENGAGEMENT_KEY, JSON.stringify(engagement))
  } catch {}
  window.dispatchEvent(new CustomEvent("post-engagement-ready", { detail: engagement }))
}

export function getPostEngagement(publicId: string) {
  try { return readEngagement(sessionStorage.getItem(engagementKey(publicId))) } catch { return null }
}

async function sendAction(engagement: Engagement | null, action: "copied_link" | "commented" | "sent_message") {
  if (!engagement) return
  await fetch("/api/engagement", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: engagement.token, event: "action", action }),
    keepalive: true,
  }).catch(() => undefined)
}

export function recordCurrentPostAction(action: "copied_link" | "commented") {
  let engagement: Engagement | null = null
  try { engagement = readEngagement(sessionStorage.getItem(LATEST_ENGAGEMENT_KEY)) } catch {}
  if (!engagement || engagement.path !== window.location.pathname) return Promise.resolve()
  return sendAction(engagement, action)
}

export function recordLatestPostMessage() {
  let engagement: Engagement | null = null
  try { engagement = readEngagement(sessionStorage.getItem(LATEST_ENGAGEMENT_KEY)) } catch {}
  return sendAction(engagement, "sent_message")
}
