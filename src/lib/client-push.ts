type PushStatus = {
  topics: Array<"posts" | "notes">
  adminEvents: boolean
  messageEvents: boolean
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

async function statusFor(subscription: PushSubscription): Promise<PushStatus> {
  const response = await fetch("/api/push/subscriptions", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: subscription.endpoint }),
  })
  if (!response.ok) return { topics: [], adminEvents: false, messageEvents: false }
  const status = await response.json() as Partial<PushStatus>
  return {
    topics: Array.isArray(status.topics) ? status.topics : [],
    adminEvents: status.adminEvents === true,
    messageEvents: status.messageEvents === true,
  }
}

export async function messagePushPreference() {
  if (!supported() || Notification.permission !== "granted") return false
  const registration = await navigator.serviceWorker.getRegistration("/")
  const subscription = await registration?.pushManager.getSubscription()
  if (!subscription) return false
  return (await statusFor(subscription)).messageEvents
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

  const status = await statusFor(subscription)
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
  window.dispatchEvent(new Event("push:preferences-changed"))
}
