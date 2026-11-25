"use client"

import { useEffect, useState } from "react"
import { Stack } from "@astryxdesign/core/Stack"
import { Grid } from "@astryxdesign/core/Grid"
import { Text } from "@astryxdesign/core/Text"
import { Theme } from "@astryxdesign/core/theme"
import { FilmIcon, ArrowUpRightIcon } from "@heroicons/react/24/outline"
import { useThemeSwitcher } from "@/components/ThemeSwitcher"
import { themes, defaultThemeSlug } from "@/astryx-themes"
import { currentWatching, parseWatchingStatus, type WatchingStatus } from "@/lib/watching"

export function WatchingCard() {
  const { darkMode } = useThemeSwitcher()
  const [status, setStatus] = useState<{ data: WatchingStatus; now: number } | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    let timer: ReturnType<typeof setTimeout>
    let expiry: ReturnType<typeof setTimeout>
    async function refresh() {
      try {
        if (document.visibilityState !== "hidden") {
          const response = await fetch("/api/links/watching", { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(8000)]) })
          if (!response.ok) throw new Error("Reprodução indisponível")
          const data = parseWatchingStatus(await response.json())
          if (active) {
            const now = Date.now()
            clearTimeout(expiry)
            setStatus({ data, now })
            if (data.current) expiry = setTimeout(() => { if (active) setStatus(null) }, Math.max(0, 45_000 - (now - Date.parse(data.current.updatedAt))))
          }
        }
      } catch {
        if (active) setStatus(null)
      } finally {
        if (active) timer = setTimeout(refresh, 15_000)
      }
    }
    void refresh()
    return () => { active = false; controller.abort(); clearTimeout(timer); clearTimeout(expiry) }
  }, [])

  const video = status ? currentWatching(status.data, status.now) : null
  if (!video) return null

  return <Theme theme={themes[defaultThemeSlug]} mode={darkMode ? "dark" : "light"}><a href={video.url} target="_blank" rel="noopener noreferrer" aria-label={`Assistindo agora: ${video.title}${video.episode ? `, ${video.episode}` : ""}. Abrir na Netflix`} className="mt-6 block rounded-xl border border-neutral-200 text-inherit no-underline hover:border-neutral-400 focus-visible:outline-2 focus-visible:outline-offset-4 dark:border-white/15 dark:hover:border-white/40">
    <Stack as="article" direction="horizontal" gap={2} padding={2} vAlign="center">
      <figure className="relative m-0 grid size-12 shrink-0 place-items-center overflow-hidden rounded-md bg-neutral-100 dark:bg-neutral-900">
        {video.cover && <img key={video.cover} src={video.cover} width={48} height={48} alt="" loading="lazy" referrerPolicy="no-referrer" className="absolute inset-0 z-10 size-full object-cover" onError={event => { event.currentTarget.hidden = true }} />}
        <FilmIcon aria-hidden="true" className="size-5 text-neutral-500" />
      </figure>
      <Stack as="header" gap={0} className="h-12 min-w-0 flex-1 leading-4">
        <Grid columns={1} gap={0} height="100%" align="center">
          <Text as="p" type="inherit" size="xsm" color="secondary" maxLines={1} hasCapsize>Assistindo agora · Netflix</Text>
          <Text as="h2" type="inherit" size="sm" weight="semibold" maxLines={1} hasCapsize>{video.title}</Text>
          {video.episode && <Text as="p" type="inherit" size="xsm" color="secondary" maxLines={1} hasCapsize>{video.episode}</Text>}
        </Grid>
      </Stack>
      <ArrowUpRightIcon aria-hidden="true" className="size-4 shrink-0 text-neutral-500" />
    </Stack>
  </a></Theme>
}
