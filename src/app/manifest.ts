import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "domenyk",
    short_name: "domenyk",
    description: "Posts e notas de Domenyk.",
    start_url: "/",
    display: "standalone",
    background_color: "#040404",
    theme_color: "#040404",
    icons: [{ src: "/favicon.ico", sizes: "256x256", type: "image/x-icon" }],
  }
}
