import { getIndexableNotes } from "@/lib/db/notes"
import { absoluteUrl, preferredContentImages } from "@/lib/seo"

export const runtime = "nodejs"

function escapeXml(value: string) {
  return value.replace(/[<>&'\"]/g, (character) => ({
    "<": "&lt;",
    ">": "&gt;",
    "&": "&amp;",
    "'": "&apos;",
    '"': "&quot;",
  })[character] ?? character)
}

export async function GET() {
  const notes = await getIndexableNotes({ limit: 50_000 })
  const urls = notes.map((note) => {
    const images = preferredContentImages({ images: note.images, markdown: note.content })
      .map((image) => `<image:image><image:loc>${escapeXml(absoluteUrl(image))}</image:loc></image:image>`)
      .join("")
    const lastModified = (note.updatedAt ?? note.createdAt).toISOString()
    return `<url><loc>${escapeXml(absoluteUrl(`/notes/${note._id.toString()}`))}</loc><lastmod>${lastModified}</lastmod><changefreq>monthly</changefreq><priority>0.5</priority>${images}</url>`
  }).join("")

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">${urls}</urlset>`
  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
    },
  })
}
