type PushStatus = {
  topics: Array<"posts" | "notes">
  adminEvents: boolean
  messageEvents: boolean
  subscribed: boolean
  pending: boolean
}

export function applicationServerKey(value: string) {
  const padding = "=".repeat((4 - value.length % 4) % 4)
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/")
  const raw = window.atob(base64)
  return Uint8Array.from(raw, (character) => character.charCodeAt(0))
}

function supported() {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window
}

export async function pushStatusFor(subscription: PushSubscription): Promise<PushStatus> {
  const response = await fetch("/api/push/subscriptions", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(subscription.toJSON()),
  })
  if (!response.ok) return { topics: [], adminEvents: false, messageEvents: false, subscribed: false, pending: false }
  const status = await response.json() as Partial<PushStatus>
  return {
    topics: Array.isArray(status.topics) ? status.topics : [],
    adminEvents: status.adminEvents === true,
    messageEvents: status.messageEvents === true,
    subscribed: status.subscribed === true,
    pending: status.pending === true,
  }
}

export async function waitForPushVerification(subscription: PushSubscription): Promise<void> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const status = await pushStatusFor(subscription)
    if (status.subscribed) return
    if (!status.pending) break
    await new Promise((resolve) => window.setTimeout(resolve, 400))
  }
  throw new Error("Não foi possível confirmar o recebimento neste dispositivo.")
}

export async function revokePrivatePushForCurrentDevice(): Promise<void> {
  if (!("serviceWorker" in navigator)) return
  const registration = await navigator.serviceWorker.getRegistration("/")
  const subscription = await registration?.pushManager.getSubscription()
  if (!subscription) return

  const response = await fetch("/api/push/subscriptions", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(subscription.toJSON()),
    keepalive: true,
  })
  if (response.ok) return
  await subscription.unsubscribe().catch(() => false)
  throw new Error("Não foi possível revogar os alertas privados.")
}

export async function messagePushPreference() {
  if (!supported() || Notification.permission !== "granted") return false
  const registration = await navigator.serviceWorker.getRegistration("/")
  const subscription = await registration?.pushManager.getSubscription()
  if (!subscription) return false
  return (await pushStatusFor(subscription)).messageEvents
}

export async function setMessagePushPreference(enabled: boolean) {
  if (!supported()) throw new Error("Este navegador não oferece notificações para sites.")

  const permissionPromise = enabled && Notification.permission === "default"
    ? Notification.requestPermission()
    : Promise.resolve(Notification.permission)
  const permission = await permissionPromise
  if (enabled && permission !== "granted") {
    throw new Error("A permissão de notificações não foi concedida.")
  }

  let registration = await navigator.serviceWorker.getRegistration("/")
  let subscription = await registration?.pushManager.getSubscription() ?? null
  if (!enabled && !subscription) return

  const configResponse = await fetch("/api/push/config", { cache: "no-store" })
  const config = await configResponse.json() as { configured?: boolean; publicKey?: string | null }
  if (!config.configured || !config.publicKey) throw new Error("As notificações ainda não foram configuradas pelo site.")

  if (!registration) {
    registration = await navigator.serviceWorker.register("/push-service-worker.js", { scope: "/" })
  }
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: applicationServerKey(config.publicKey),
    })
  }

  const status = await pushStatusFor(subscription)
  const response = await fetch("/api/push/subscriptions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...subscription.toJSON(),
      topics: status.topics,
      adminEvents: status.adminEvents,
      messageEvents: enabled,
    }),
  })
  if (!response.ok) {
    const data = await response.json().catch(() => null) as { error?: string } | null
    throw new Error(data?.error || "Não foi possível salvar a preferência de mensagens.")
  }
  const result = await response.json().catch(() => null) as { pending?: boolean } | null
  if (result?.pending) await waitForPushVerification(subscription)
  window.dispatchEvent(new Event("push:preferences-changed"))
}
