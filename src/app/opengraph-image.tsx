import { ImageResponse } from "next/og"
import { siteConfig } from "@/lib/seo"

export const alt = siteConfig.title
export const size = {
  width: 1200,
  height: 630,
}
export const contentType = "image/png"

export default function Image() {
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
          padding: 72,
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <img
            src={`${siteConfig.url}/images/profile.jpg`}
            alt=""
            width={112}
            height={112}
            style={{ borderRadius: 56 }}
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 48, fontWeight: 700 }}>{siteConfig.name}</div>
            <div style={{ fontSize: 24, color: "#A8A095" }}>Política e liberalismo</div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ fontSize: 70, lineHeight: 1.05, fontWeight: 800 }}>
            Política, liberalismo e ideias
          </div>
          <div style={{ maxWidth: 880, fontSize: 30, lineHeight: 1.35, color: "#d7d7d7" }}>
            {siteConfig.description}
          </div>
        </div>

        <div style={{ fontSize: 24, color: "#E00070" }}>domenyk.com</div>
      </div>
    ),
    size
  )
}
