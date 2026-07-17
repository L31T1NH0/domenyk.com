type RequestMetadata = {
  method: string
  url: string
  headers: Pick<Headers, "get">
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"])

function headerOrigin(value: string | null): string | null {
  if (!value) return null
  try {
    return new URL(value).origin
  } catch {
    return null
  }
}

export function isMutationMethod(method: string): boolean {
  return !SAFE_METHODS.has(method.toUpperCase())
}

export function isSameOriginRequest(
  request: RequestMetadata,
  enforce = process.env.NODE_ENV === "production"
): boolean {
  if (!enforce) return true

  const targetOrigin = new URL(request.url).origin
  const fetchSite = request.headers.get("sec-fetch-site")
  const origin = headerOrigin(request.headers.get("origin"))

  if (fetchSite && fetchSite !== "same-origin") return false
  if (origin) return origin === targetOrigin
  if (request.headers.get("origin")) return false
  if (fetchSite === "same-origin") return true

  const referer = headerOrigin(request.headers.get("referer"))
  return referer === targetOrigin
}

export function shouldBlockApiMutation(
  request: RequestMetadata,
  enforce = process.env.NODE_ENV === "production"
): boolean {
  return isMutationMethod(request.method) && !isSameOriginRequest(request, enforce)
}
