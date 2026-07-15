import "server-only"

import { absoluteUrl, siteConfig } from "@/lib/seo"

export async function notifyIndexNow(paths: string[]): Promise<boolean> {
  const key = process.env.INDEXNOW_KEY?.trim()
  if (!key || paths.length === 0) return false

  const site = new URL(siteConfig.url)
  const urlList = Array.from(new Set(paths.map(absoluteUrl))).filter((url) => {
    try {
      return new URL(url).host === site.host
    } catch {
      return false
    }
  })
  if (urlList.length === 0) return false

  try {
    const response = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        host: site.host,
        key,
        keyLocation: absoluteUrl("/indexnow-key.txt"),
        urlList,
      }),
      signal: AbortSignal.timeout(8_000),
    })
    return response.ok
  } catch {
    return false
  }
}
