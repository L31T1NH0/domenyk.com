import { ImageResponse } from "next/og"
import { getPostByPublicIdentifier } from "@/lib/db/posts"
import { descriptionFromMarkdown, siteConfig } from "@/lib/seo"
import { isPostLocale } from "@/lib/post-locales"
import { getPostVersion } from "@/lib/post-versions"
import { isPostVersionIndexable, postSeoDescription, postSeoTitle } from "@/lib/post-seo"

export const runtime = "nodejs"

const size = {
  width: 1200,
  height: 630,
}

const NOT_FOUND_HEADERS = {
  "Cache-Control": "public, max-age=300, s-maxage=300, stale-while-revalidate=3600",
}

function trimText(text: string, maxLength: number) {
  if (text.length <= maxLength) return text
  const truncated = text.slice(0, maxLength + 1)
  return `${truncated.slice(0, truncated.lastIndexOf(" ") || maxLength).trim()}...`
}

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const localeParam = new URL(req.url).searchParams.get("locale") ?? "pt"
  if (
    slug.length > 180 ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) ||
    !isPostLocale(localeParam)
  ) {
    return new Response(null, { status: 404, headers: NOT_FOUND_HEADERS })
  }

  const locale = localeParam
  const post = await getPostByPublicIdentifier(slug)
  const version = post ? getPostVersion(post, locale) : null
  const indexable = version ? isPostVersionIndexable(version) : false
  if (!post || !version || !indexable) {
    return new Response(null, { status: 404, headers: NOT_FOUND_HEADERS })
  }

  const title = postSeoTitle(version)
  const description = postSeoDescription(version, descriptionFromMarkdown(version.content, 120)) || siteConfig.description
  const tags = version.tags.slice(0, 3)

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#050505",
          color: "#f5f5f5",
          padding: 68,
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <img
              src={`${siteConfig.url}/images/profile.jpg`}
              alt=""
              width={72}
              height={72}
              style={{ borderRadius: 36 }}
            />
            <div style={{ fontSize: 30, fontWeight: 700 }}>{siteConfig.name}</div>
          </div>
          <div style={{ fontSize: 24, color: "#A8A095" }}>domenyk.com</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ maxWidth: 980, fontSize: 62, lineHeight: 1.05, fontWeight: 800 }}>
            {trimText(title, 86)}
          </div>
          <div style={{ maxWidth: 900, fontSize: 28, lineHeight: 1.35, color: "#d7d7d7" }}>
            {trimText(description, 130)}
          </div>
        </div>

        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          {tags.length > 0 ? tags.map((tag) => (
            <div
              key={tag}
              style={{
                border: "1px solid rgba(168, 160, 149, 0.55)",
                borderRadius: 999,
                padding: "8px 16px",
                color: "#A8A095",
                fontSize: 22,
              }}
            >
              #{tag}
            </div>
          )) : (
            <div style={{ fontSize: 24, color: "#E00070" }}>Política e liberalismo</div>
          )}
        </div>
      </div>
    ),
    {
      ...size,
      headers: {
        "Cache-Control": "public, max-age=300, s-maxage=86400, stale-while-revalidate=604800",
      },
    }
  )
}
