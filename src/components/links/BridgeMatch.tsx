import localFont from "next/font/local"
import { Stack } from "@astryxdesign/core/Stack"
import { Text } from "@astryxdesign/core/Text"
import { Theme } from "@astryxdesign/core/theme"
import { themes, defaultThemeSlug } from "@/astryx-themes"
import type { BridgePlayer } from "@/lib/bridge"

const monocraft = localFont({
  src: "../../../public/fonts/monocraft/Monocraft.ttf",
  display: "swap",
  preload: false,
  fallback: ["monospace"],
})

export function BridgeMatch({ red, blue, elapsedSeconds }: { red: BridgePlayer; blue: BridgePlayer; elapsedSeconds: number }) {
  const elapsed = Math.max(0, Math.floor(elapsedSeconds))
  const time = `${String(Math.floor(elapsed / 60)).padStart(2, "0")}:${String(elapsed % 60).padStart(2, "0")}`
  return <Theme theme={themes[defaultThemeSlug]} mode="dark">
    <Stack as="article" direction="horizontal" gap={2} padding={2} vAlign="center" className="mt-6 min-w-0 rounded-(--radius-container) border border-neutral-800 bg-neutral-950" aria-label={`The Bridge 1v1: ${red.name}, vermelho${red.disconnected ? ", saiu da partida" : ""}, ${red.score} pontos; ${blue.name}, azul${blue.disconnected ? ", saiu da partida" : ""}, ${blue.score} pontos. Tempo de partida: ${time}`}>
      <img src="/images/links/the-bridge.png" width={48} height={48} alt="" className="size-12 shrink-0 object-contain" />
      <Stack hAlign="center" className="min-w-0 flex-1">
        <Stack gap={1.5} className="w-fit max-w-full">
          <Stack direction="horizontal" gap={1} hAlign="center" vAlign="center">
            <Text as="p" type="inherit" size="xsm" color="secondary" justify="center">The Bridge 1v1</Text>
            <time dateTime={`PT${elapsed}S`} className={`${monocraft.className} shrink-0 text-xs text-neutral-400 tabular-nums`} aria-label={`Tempo de partida: ${time}`}>· {time}</time>
          </Stack>
          <Stack direction="horizontal" gap={1.5} hAlign="center" vAlign="center" className={`${monocraft.className} min-w-0`} aria-hidden="true">
            <Text as="p" type="inherit" size="base" color="inherit" className={`${monocraft.className} min-w-0 break-all ${red.disconnected ? "text-neutral-400" : "text-red-400"}`}>{red.name}</Text>
            <Stack direction="horizontal" gap={1} vAlign="center" className="shrink-0">
              <Text type="inherit" size="base" color="inherit" hasTabularNumbers className="text-red-400">{red.score}</Text>
              <Text type="inherit" size="base" color="secondary">×</Text>
              <Text type="inherit" size="base" color="inherit" hasTabularNumbers className="text-blue-400">{blue.score}</Text>
            </Stack>
            <Text as="p" type="inherit" size="base" color="inherit" className={`${monocraft.className} min-w-0 break-all ${blue.disconnected ? "text-neutral-400" : "text-blue-400"}`}>{blue.name}</Text>
          </Stack>
        </Stack>
      </Stack>
    </Stack>
  </Theme>
}
