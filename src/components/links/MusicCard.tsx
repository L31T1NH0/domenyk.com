"use client"

import { useEffect, useRef, useState } from "react"
import { BackwardIcon, ForwardIcon, MusicalNoteIcon, PauseIcon, PlayIcon } from "@heroicons/react/24/solid"
import { ArrowsRightLeftIcon } from "@heroicons/react/24/outline"
import { musicQueue, musicTime, nextMusicIndex, parseMusicStatus, type MusicQueueItem, type MusicStatus, type MusicTrack } from "@/lib/music"
import styles from "./MusicCard.module.css"

export function MusicCard() {
  const [status, setStatus] = useState<{ data: MusicStatus; now: number } | null>(null)
  const [browse, setBrowse] = useState<{ items: MusicQueueItem[]; index: number; autoPlay: boolean } | null>(null)
  const [shuffle, setShuffle] = useState(false)
  const playing = useRef(false)

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
        if (active) timer = setTimeout(refresh, 15_000)
      }
    }
    void refresh()
    return () => { active = false; controller.abort(); clearTimeout(timer) }
  }, [])

  const live = status ? musicQueue(status.data, status.now) : []
  // Keep the visitor's queue stable while they explore, even when the owner skips.
  const items = browse?.items ?? live
  const index = browse?.index ?? 0
  const item = items[index]
  if (!item) return null
  const isCurrent = item.current && live[0]?.current && live[0].track.id === item.track.id
  function move(direction: number) {
    setBrowse({ items, index: nextMusicIndex(index, items.length, direction, shuffle), autoPlay: playing.current })
  }
  function onPlaying(value: boolean) {
    playing.current = value
    if (value) setBrowse(previous => previous ?? { items, index, autoPlay: false })
  }
  return <section className={styles.card} aria-label="Músicas que eu escuto">
    <div className={styles.top}>
      <div className={styles.cover}>
        {item.track.cover ? <img key={item.track.cover} src={item.track.cover} alt={`Capa de ${item.track.title}`} width={80} height={80} loading="lazy" onError={event => { event.currentTarget.hidden = true }} /> : null}
        <MusicalNoteIcon aria-hidden="true" />
      </div>
      <div className={styles.details} aria-live="polite">
        <p className={styles.origin}>{isCurrent ? <><span className={styles.dot} />Ouvindo agora</> : item.current ? "Ouvida recentemente" : "Das minhas mais ouvidas"}</p>
        <p className={styles.title} title={item.track.title}>{item.track.title}</p>
        <p className={styles.artist}>{item.track.artist || "Artista não informado"}</p>
      </div>
      <span className={styles.counter} aria-label={`Faixa ${index + 1} de ${items.length}`}>{String(index + 1).padStart(2, "0")} / {items.length}</span>
    </div>
    <PreviewPlayer key={item.track.id} track={item.track} autoPlay={browse?.autoPlay ?? false} onPlaying={onPlaying} onPrevious={() => move(-1)} onNext={() => move(1)} canNavigate={items.length > 1} shuffle={shuffle} toggleShuffle={() => setShuffle(value => !value)} />
  </section>
}

type PlayerProps = { track: MusicTrack; autoPlay: boolean; onPlaying: (value: boolean) => void; onPrevious: () => void; onNext: () => void; canNavigate: boolean; shuffle: boolean; toggleShuffle: () => void }
function PreviewPlayer({ track, autoPlay, onPlaying, onPrevious, onNext, canNavigate, shuffle, toggleShuffle }: PlayerProps) {
  const audio = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [position, setPosition] = useState(0)
  const [duration, setDuration] = useState(30)
  const [error, setError] = useState("")
  const playable = !!track.previewUrl

  useEffect(() => {
    const element = audio.current
    let active = true
    if (autoPlay && element && track.previewUrl) void element.play().catch(() => { if (active) setError("Toque em reproduzir para ouvir a prévia.") })
    return () => { active = false; element?.pause() }
  }, [autoPlay, track.previewUrl])

  function toggle() {
    const element = audio.current
    if (!element || !playable) return
    setError("")
    if (!element.paused) { element.pause(); return }
    if (element.currentTime >= duration) element.currentTime = 0
    void element.play().catch(() => setError("Não foi possível reproduzir esta prévia."))
  }
  function playback(value: boolean) { setPlaying(value); onPlaying(value) }
  return <>
    <audio ref={audio} src={track.previewUrl || undefined} preload="none" onPlay={() => playback(true)} onPause={() => playback(false)} onEnded={() => playback(false)} onError={() => { playback(false); setError("Prévia indisponível para esta faixa.") }} onLoadedMetadata={() => {
      const length = audio.current?.duration
      if (length && Number.isFinite(length)) setDuration(Math.min(30, length))
    }} onTimeUpdate={() => {
      const element = audio.current
      if (!element) return
      setPosition(Math.min(duration, element.currentTime))
      if (element.currentTime >= duration) element.pause()
    }} />
    <div className={styles.controls}>
      <span className={styles.previewLabel}>{playable ? "Prévia · 30 s" : "Sem prévia disponível"}</span>
      <button type="button" onClick={onPrevious} disabled={!canNavigate} aria-label="Faixa anterior"><BackwardIcon /></button>
      <button type="button" onClick={toggle} disabled={!playable} className={styles.play} aria-label={playing ? "Pausar prévia" : "Reproduzir prévia"}>{playing ? <PauseIcon /> : <PlayIcon />}</button>
      <button type="button" onClick={onNext} disabled={!canNavigate} aria-label="Próxima faixa"><ForwardIcon /></button>
      <button type="button" onClick={toggleShuffle} disabled={!canNavigate} aria-label="Ordem aleatória" aria-pressed={shuffle} className={shuffle ? styles.shuffleActive : undefined}><ArrowsRightLeftIcon /></button>
    </div>
    <label className={styles.progress}>
      <span className="sr-only">Posição da prévia de {track.title}</span>
      <input type="range" min={0} max={duration} step={0.1} value={position} disabled={!playable} onChange={event => {
        const value = Number(event.target.value)
        if (audio.current && Number.isFinite(audio.current.duration)) { audio.current.currentTime = value; setPosition(value) }
      }} />
    </label>
    <div className={styles.times} aria-hidden="true"><span>{musicTime(position)}</span><span>{playable ? musicTime(duration) : "—"}</span></div>
    {error && <p role="status" className={styles.error}>{error}</p>}
    {track.catalogUrl && <div className={styles.catalog}>
      <span>Prévia fornecida pelo iTunes.</span>
      <a href={track.catalogUrl} target="_blank" rel="noopener noreferrer" aria-label={`Ver ${track.title} no iTunes Store`}><img src="/images/links/itunes-store.svg" width={100} height={34} alt="Disponível no iTunes Store" /></a>
    </div>}
    {!track.catalogUrl && track.url && <a className={styles.source} href={track.url} target="_blank" rel="noopener noreferrer">Ouvir na fonte ↗</a>}
  </>
}
