"use client"

import { useEffect, useState } from "react"
import { MusicalNoteIcon } from "@heroicons/react/24/solid"
import { ArrowUpRightIcon } from "@heroicons/react/24/outline"
import { currentMusic, youtubeMusicSearch, parseMusicStatus, type MusicStatus } from "@/lib/music"
import styles from "./MusicCard.module.css"

export function MusicCard() {
  const [status, setStatus] = useState<{ data: MusicStatus; now: number } | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    let timer: ReturnType<typeof setTimeout>
    async function refresh() {
      try {
        if (document.visibilityState !== "hidden") {
          const response = await fetch("/api/links/music", { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(8000)]) })
          if (!response.ok) throw new Error("Músicas indisponíveis")
          const data = parseMusicStatus(await response.json())
          if (active) setStatus({ data, now: Date.now() })
        }
      } catch {
        if (active) setStatus(null)
      } finally {
        if (active) {
          timer = setTimeout(refresh, 15_000)
        }
      }
    }
    void refresh()
    return () => { active = false; controller.abort(); clearTimeout(timer) }
  }, [])

  const track = status ? currentMusic(status.data, status.now) : null
  if (!track) return null

  return <a className={styles.link} href={youtubeMusicSearch(track.title)} target="_blank" rel="noopener noreferrer" title="Buscar no YouTube" aria-label={`${track.title}${track.artist ? `, ${track.artist}` : ""}: buscar no YouTube`}>
    <article className={styles.card}>
      <figure className={styles.cover}>
        {track.cover && <img key={track.cover} src={track.cover} alt="" width={48} height={48} loading="lazy" onError={event => { event.currentTarget.hidden = true }} />}
        <MusicalNoteIcon aria-hidden="true" />
      </figure>
      <header className={styles.details}>
        <p className={styles.origin}>Ouvindo agora</p>
        <h2 className={styles.title} title={track.title}>{track.title}</h2>
        {track.artist && <p className={styles.artist} title={track.artist}>{track.artist}</p>}
      </header>
      <ArrowUpRightIcon className={styles.arrow} aria-hidden="true" />
    </article>
  </a>
}
