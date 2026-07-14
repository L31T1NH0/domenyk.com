self.addEventListener("push", (event) => {
  let data = null
  try {
    data = event.data ? event.data.json() : null
  } catch {
    data = null
  }
  if (!data || typeof data.title !== "string" || typeof data.body !== "string") return

  const target = typeof data.url === "string" && data.url.startsWith("/") && !data.url.startsWith("//")
    ? data.url
    : "/"
  event.waitUntil(self.registration.showNotification(data.title, {
    body: data.body,
    icon: "/favicon.ico",
    badge: "/favicon.ico",
    tag: typeof data.tag === "string" ? data.tag : undefined,
    data: { url: target },
  }))
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const candidate = new URL(event.notification.data?.url || "/", self.location.origin)
  const target = candidate.origin === self.location.origin ? candidate.href : `${self.location.origin}/`
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true })
    for (const client of windows) {
      if (client.url === target && "focus" in client) return client.focus()
    }
    const visible = windows.find((client) => "navigate" in client)
    if (visible) {
      await visible.navigate(target)
      return visible.focus()
    }
    return self.clients.openWindow(target)
  })())
})
