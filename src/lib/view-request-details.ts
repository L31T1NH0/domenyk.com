import "server-only"

import { type NextRequest, userAgent } from "next/server"
import type { NotificationOccurrenceDetails } from "./db/notifications"

export type ViewClientContext = {
  referrer?: unknown
  landingPage?: unknown
  language?: unknown
  visitorType?: unknown
  utmSource?: unknown
  utmMedium?: unknown
  utmCampaign?: unknown
}

const DEVICE_LABELS: Record<string, string> = {
  mobile: "Celular",
  tablet: "Tablet",
  console: "Console",
  smarttv: "Smart TV",
  wearable: "Dispositivo vestível",
  embedded: "Dispositivo integrado",
}

function sourceLabel(rawReferrer: string | null, siteOrigin: string) {
  const referrer = rawReferrer?.trim().slice(0, 2048)
  if (!referrer) return "Acesso direto"

  try {
    const url = new URL(referrer)
    if (url.origin === siteOrigin) {
      if (url.pathname === "/") return "Página inicial"
      if (url.pathname === "/notes" || url.pathname.startsWith("/notes/")) return "Página de notas"
      return "Navegação interna"
    }
    return url.hostname.replace(/^www\./, "")
  } catch {
    return "Origem desconhecida"
  }
}

function text(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : ""
}

function locationLabel(req: NextRequest) {
  const country = text(req.headers.get("x-vercel-ip-country") ?? req.headers.get("cf-ipcountry"), 12)
  const rawCity = text(req.headers.get("x-vercel-ip-city"), 100)
  let city = rawCity
  try { city = decodeURIComponent(rawCity) } catch {}
  return [city, country].filter(Boolean).join(", ") || "Localização indisponível"
}

export function viewRequestDetails(req: NextRequest, client: ViewClientContext): NotificationOccurrenceDetails {
  const agent = userAgent(req)
  const deviceType = agent.device.type ?? "desktop"
  const deviceLabel = DEVICE_LABELS[deviceType] ?? "Computador"
  const device = (agent.device.model ? `${deviceLabel} · ${agent.device.model}` : deviceLabel).slice(0, 100)
  const browser = agent.browser.name
    ? [agent.browser.name, agent.browser.version].filter(Boolean).join(" ")
    : agent.isBot ? "Robô" : "Navegador desconhecido"
  const os = [agent.os.name, agent.os.version].filter(Boolean).join(" ") || "Sistema desconhecido"
  const campaignParts = [
    text(client.utmSource, 100),
    text(client.utmMedium, 100),
    text(client.utmCampaign, 150),
  ].filter(Boolean)

  return {
    source: sourceLabel(text(client.referrer, 2048), req.nextUrl.origin),
    device,
    browser: browser.slice(0, 100),
    os: os.slice(0, 100),
    location: locationLabel(req),
    campaign: campaignParts.length ? campaignParts.join(" · ") : "Sem campanha",
    landingPage: text(client.landingPage, 500) || "Página de entrada desconhecida",
    language: text(client.language, 35) || "Idioma desconhecido",
    visitorType: text(client.visitorType, 30) || "Recorrência desconhecida",
    trafficType: agent.isBot ? "Bot" : "Pessoa",
  }
}
