"use client"

import { useEffect, useState } from "react"
import { MusicalNoteIcon } from "@heroicons/react/24/solid"
import { ArrowUpRightIcon } from "@heroicons/react/24/outline"
import { currentMusic, youtubeMusicSearch, parseMusicStatus, type MusicStatus } from "@/lib/music"
import styles from "./MusicCard.module.css"

export function MusicCard() {
  const [loading, setLoading] = useState(true)
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
        if (active) setStatus(previous => previous && { ...previous, now: Date.now() })
      } finally {
        if (active) {
          setLoading(false)
          timer = setTimeout(refresh, 15_000)
        }
      }
    }
    void refresh()
    return () => { active = false; controller.abort(); clearTimeout(timer) }
  }, [])

  const track = status ? currentMusic(status.data, status.now) : null
  return <section className={styles.card} aria-label="Música que estou ouvindo" aria-busy={loading}>
    <div className={styles.cover}>
      {track?.cover && <img key={track.cover} src={track.cover} alt={`Capa de ${track.title}`} width={72} height={72} loading="lazy" onError={event => { event.currentTarget.hidden = true }} />}
      <MusicalNoteIcon aria-hidden="true" />
    </div>
    <div className={styles.details} aria-live="polite">
      <p className={styles.origin}>{track && <span className={styles.dot} />}{track ? "Ouvindo agora" : "Música"}</p>
      <p className={styles.title} title={track?.title}>{track?.title || (loading ? "Carregando música…" : status ? "Nenhuma música tocando agora" : "Música indisponível no momento")}</p>
      <p className={styles.artist}>{track ? track.artist || "Artista não informado" : "O que estou ouvindo aparece aqui."}</p>
      {track ? <a className={styles.search} href={youtubeMusicSearch(track.title)} target="_blank" rel="noopener noreferrer">Buscar no YouTube <ArrowUpRightIcon aria-hidden="true" /></a> : <span className={styles.search} aria-hidden="true" />}
    </div>
  </section>
}
