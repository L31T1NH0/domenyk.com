const INTERNAL_REFERRER_KEY = "domenyk:internal-referrer"
const ENTRY_PAGE_KEY = "domenyk:entry-page"
const KNOWN_VISITOR_KEY = "domenyk:known-visitor"
const VISITOR_TYPE_KEY = "domenyk:visitor-type"

type StoredReferrer = {
  from: string
  to: string
  at: number
}

export function rememberInternalReferrer(from: string, to: string) {
  try {
    sessionStorage.setItem(INTERNAL_REFERRER_KEY, JSON.stringify({ from, to, at: Date.now() }))
  } catch {}
}

export function initializeVisitorContext() {
  try {
    if (!sessionStorage.getItem(ENTRY_PAGE_KEY)) {
      sessionStorage.setItem(ENTRY_PAGE_KEY, `${window.location.pathname}${window.location.search}`.slice(0, 500))
    }
    if (!sessionStorage.getItem(VISITOR_TYPE_KEY)) {
      const visitorType = localStorage.getItem(KNOWN_VISITOR_KEY) ? "Visitante recorrente" : "Novo visitante"
      sessionStorage.setItem(VISITOR_TYPE_KEY, visitorType)
      localStorage.setItem(KNOWN_VISITOR_KEY, new Date().toISOString())
    }
  } catch {}
}

export function viewReferrer() {
  try {
    const stored = JSON.parse(sessionStorage.getItem(INTERNAL_REFERRER_KEY) ?? "null") as StoredReferrer | null
    if (stored && Date.now() - stored.at < 60_000) {
      const target = new URL(stored.to)
      if (target.pathname === window.location.pathname) {
        sessionStorage.removeItem(INTERNAL_REFERRER_KEY)
        return stored.from.slice(0, 2048)
      }
    }
  } catch {}
  return document.referrer.slice(0, 2048)
}

export function viewClientContext() {
  initializeVisitorContext()
  let visitorType = "Recorrência desconhecida"
  let landingPage = `${window.location.pathname}${window.location.search}`.slice(0, 500)

  try {
    landingPage = sessionStorage.getItem(ENTRY_PAGE_KEY) ?? landingPage
    visitorType = sessionStorage.getItem(VISITOR_TYPE_KEY) ?? visitorType
  } catch {}

  const entryUrl = new URL(landingPage, window.location.origin)
  return {
    referrer: viewReferrer(),
    landingPage: entryUrl.pathname.slice(0, 500),
    language: navigator.language.slice(0, 35),
    visitorType,
    utmSource: entryUrl.searchParams.get("utm_source")?.slice(0, 100) ?? "",
    utmMedium: entryUrl.searchParams.get("utm_medium")?.slice(0, 100) ?? "",
    utmCampaign: entryUrl.searchParams.get("utm_campaign")?.slice(0, 150) ?? "",
  }
}
