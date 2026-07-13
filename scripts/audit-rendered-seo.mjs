const baseUrl = new URL(process.argv[2] ?? "http://localhost:3000")
const sitemapPaths = [
  "/sitemap/index.xml",
  "/sitemap/topics.xml",
  "/sitemap/posts-0.xml",
  "/sitemap/notes-0.xml",
]

function allMatches(value, pattern) {
  return [...value.matchAll(pattern)].map((match) => match[1])
}

function decoded(value = "") {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#x27;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
}

const issues = []
const sitemapUrls = new Set()
for (const path of sitemapPaths) {
  const response = await fetch(new URL(path, baseUrl))
  if (!response.ok) {
    issues.push({ url: path, message: `sitemap respondeu ${response.status}` })
    continue
  }
  const xml = await response.text()
  for (const url of allMatches(xml, /<loc>([^<]+)<\/loc>/g)) sitemapUrls.add(decoded(url))
}

const results = []
for (const publicUrl of sitemapUrls) {
  const requested = new URL(publicUrl)
  const localUrl = new URL(`${requested.pathname}${requested.search}`, baseUrl)
  const response = await fetch(localUrl, { redirect: "manual" })
  const result = { url: publicUrl, status: response.status }
  results.push(result)
  if (response.status !== 200) {
    issues.push({ url: publicUrl, message: `página respondeu ${response.status}` })
    continue
  }

  const html = await response.text()
  const title = decoded(html.match(/<title>([\s\S]*?)<\/title>/i)?.[1]?.trim())
  const description = decoded(html.match(/<meta[^>]*name="description"[^>]*content="([^"]*)"/i)?.[1] ?? "")
  const canonical = html.match(/<link[^>]*rel="canonical"[^>]*href="([^"]+)"/i)?.[1]
  const robots = html.match(/<meta[^>]*name="robots"[^>]*content="([^"]+)"/i)?.[1]
  const h1Count = (html.match(/<h1\b/gi) ?? []).length
  const missingImageAltCount = allMatches(html, /<img\b([^>]*)>/gi)
    .filter((attributes) => !/\balt="[^"]*"/i.test(attributes)).length

  if (!title) issues.push({ url: publicUrl, message: "title ausente" })
  if (!description) issues.push({ url: publicUrl, message: "meta description ausente" })
  if (!canonical) issues.push({ url: publicUrl, message: "canonical ausente" })
  else if (new URL(canonical).pathname !== requested.pathname) {
    issues.push({ url: publicUrl, message: `canonical divergente: ${canonical}` })
  }
  if (!robots?.includes("index") || !robots?.includes("follow")) {
    issues.push({ url: publicUrl, message: `robots inesperado: ${robots ?? "ausente"}` })
  }
  if (h1Count !== 1) issues.push({ url: publicUrl, message: `quantidade de H1: ${h1Count}` })
  if (missingImageAltCount > 0) issues.push({ url: publicUrl, message: `${missingImageAltCount} imagem(ns) sem atributo alt` })

  for (const payload of allMatches(html, /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      JSON.parse(payload)
    } catch {
      issues.push({ url: publicUrl, message: "JSON-LD inválido" })
    }
  }
}

const robotsResponse = await fetch(new URL("/robots.txt", baseUrl))
const robotsText = await robotsResponse.text()
for (const path of sitemapPaths) {
  const publicSitemap = new URL(path, "https://domenyk.com").toString()
  if (!robotsText.includes(`Sitemap: ${publicSitemap}`)) {
    issues.push({ url: "/robots.txt", message: `sitemap não declarado: ${publicSitemap}` })
  }
}

console.log(JSON.stringify({
  summary: {
    sitemaps: sitemapPaths.length,
    pages: results.length,
    successfulPages: results.filter((result) => result.status === 200).length,
    issues: issues.length,
  },
  issues,
}, null, 2))
if (issues.length > 0) process.exitCode = 1
