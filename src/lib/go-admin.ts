import "server-only"

export class GoAdminError extends Error {
  readonly status: number
  constructor(status: number) {
    const messages: Record<number, string> = {
      400: "Confira os dados enviados ao backend.", 401: "Sua sessão expirou. Entre novamente.",
      403: "Sua conta não tem permissão para esta operação.", 404: "Registro não encontrado.",
      409: "Slug ou alias já está em uso.", 413: "O conteúdo excedeu o tamanho permitido.",
      429: "Muitas requisições. Aguarde e tente novamente.", 503: "O backend Go está indisponível. Tente novamente.",
    }
    super(messages[status] || messages[503])
    this.status = status in messages ? status : 503
  }
}

export function goAdminOrigin(value = process.env.GO_ADMIN_API_URL): URL | null {
  if (!value?.trim()) return null
  let url: URL
  try { url = new URL(value.trim()) } catch { throw new GoAdminError(503) }
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
  if ((url.protocol !== "https:" && !(local && url.protocol === "http:" && process.env.NODE_ENV !== "production")) ||
      url.username || url.password || url.search || url.hash || url.pathname !== "/") throw new GoAdminError(503)
  return url
}

export function goAPIHeaders(): Record<string, string> {
  const secret = process.env.GO_API_AUTOMATION_BYPASS_SECRET?.trim()
  return secret ? { "x-vercel-protection-bypass": secret } : {}
}

export async function requestGoAdmin<T>(origin: URL, token: string, path: string, method = "GET", body?: unknown): Promise<T> {
  if (!token || /[\r\n]/.test(token)) throw new GoAdminError(401)
  // The configured origin is trusted; route components never come from a full client URL.
  const postPath = /^\/v1\/admin\/posts(?:\/[a-f\d]{24}(?:\/themes|\/translations\/(?:en|de|id))?)?(?:\?page=\d+&limit=50)?$/i
  const linkPath = /^\/v1\/admin\/links(?:\/[a-f\d]{24})?(?:\?page=\d+&limit=50)?$/i
  const linkAction = /^\/v1\/admin\/links\/(?:settings|order|stats(?:\?days=(?:7|30|90))?|content\?(?:q=[^\s&#?]{1,900}&)?limit=50|[a-f\d]{24}\/check)$/i
  if (!postPath.test(path) && !linkPath.test(path) && !linkAction.test(path)) throw new GoAdminError(400)
  try {
    const response = await fetch(new URL(path, origin), {
      method, redirect: "error", cache: "no-store", signal: AbortSignal.timeout(10000),
      headers: { ...goAPIHeaders(), Accept: "application/json", Authorization: `Bearer ${token}`, ...(body !== undefined ? { "Content-Type": "application/json" } : {}) },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    })
    if (!response.ok) throw new GoAdminError(response.status)
    if (!response.headers.get("content-type")?.includes("application/json")) throw new GoAdminError(503)
    return await response.json() as T
  } catch (error) {
    if (error instanceof GoAdminError) throw error
    throw new GoAdminError(503)
  }
}
