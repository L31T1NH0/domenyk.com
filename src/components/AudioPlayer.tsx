"use client"

import { useEffect, useId, useRef, useState } from "react"
import {
  BoltIcon as BoltSolidIcon,
  PauseIcon,
  PlayIcon,
  SpeakerWaveIcon,
} from "@heroicons/react/20/solid"
import { BoltIcon as BoltOutlineIcon } from "@heroicons/react/24/outline"

type Props = {
  audioUrl: string
}

const BOOST_MULTIPLIER = 2

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "00:00"
  const minutes = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
}

export function AudioPlayer({ audioUrl }: Props) {
  return <AudioPlayerInner key={audioUrl} audioUrl={audioUrl} />
}

function AudioPlayerInner({ audioUrl }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const gainNodeRef = useRef<GainNode | null>(null)
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [isBoosted, setIsBoosted] = useState(false)
  const [boostAvailable, setBoostAvailable] = useState<boolean | null>(null)
  const [error, setError] = useState("")
  const controlId = useId()

  function ensureAudioGraph() {
    if (audioContextRef.current) return true
    const audio = audioRef.current
    if (!audio || typeof window === "undefined") return false

    const AudioContextClass =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext

    if (!AudioContextClass) {
      setBoostAvailable(false)
      return false
    }

    try {
      const context = new AudioContextClass()
      const source = context.createMediaElementSource(audio)
      const gainNode = context.createGain()

      source.connect(gainNode)
      gainNode.connect(context.destination)
      audio.volume = 1
      gainNode.gain.value = volume * (isBoosted ? BOOST_MULTIPLIER : 1)

      audioContextRef.current = context
      gainNodeRef.current = gainNode
      sourceRef.current = source
      setBoostAvailable(true)
      return true
    } catch {
      setBoostAvailable(false)
      return false
    }
  }

  async function togglePlayPause() {
    const audio = audioRef.current
    if (!audio) return

    if (isPlaying) {
      audio.pause()
      return
    }

    setError("")
    try {
      ensureAudioGraph()
      await audioContextRef.current?.resume()
      await audio.play()
    } catch {
      setIsPlaying(false)
      setError("Não foi possível reproduzir o áudio.")
    }
  }

  function updateDurationFromMetadata() {
    const newDuration = audioRef.current?.duration
    if (newDuration && Number.isFinite(newDuration)) {
      setDuration(newDuration)
    }
  }

  function handleSeek(event: React.ChangeEvent<HTMLInputElement>) {
    const audio = audioRef.current
    if (!audio) return

    const requestedTime = Number(event.target.value)
    const newTime = Number.isFinite(requestedTime) ? requestedTime : 0
    audio.currentTime = newTime
    setCurrentTime(newTime)
  }

  useEffect(() => {
    if (gainNodeRef.current) {
      if (audioRef.current) audioRef.current.volume = 1
      gainNodeRef.current.gain.value = volume * (isBoosted ? BOOST_MULTIPLIER : 1)
    } else if (audioRef.current) {
      audioRef.current.volume = volume
    }
  }, [volume, isBoosted])

  useEffect(() => {
    return () => {
      sourceRef.current?.disconnect()
      gainNodeRef.current?.disconnect()
      void audioContextRef.current?.close().catch(() => undefined)
    }
  }, [])

  return (
    <div role="group" className="mx-auto flex w-full max-w-2xl flex-wrap items-center gap-3 rounded-lg" aria-label="Player de áudio">
      <audio
        ref={audioRef}
        src={audioUrl}
        crossOrigin="anonymous"
        preload="metadata"
        onTimeUpdate={() => {
          const time = audioRef.current?.currentTime ?? 0
          setCurrentTime(Number.isFinite(time) ? time : 0)
        }}
        onLoadedMetadata={updateDurationFromMetadata}
        onDurationChange={updateDurationFromMetadata}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => {
          setIsPlaying(false)
          setCurrentTime(0)
        }}
        onError={() => {
          setIsPlaying(false)
          setError("Não foi possível carregar o áudio.")
        }}
        className="hidden"
      />

      <button
        type="button"
        onClick={() => void togglePlayPause()}
        className="grid size-10 place-items-center rounded-full text-zinc-700 transition-colors hover:bg-zinc-200/70 hover:text-zinc-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 dark:text-zinc-300 dark:hover:bg-white/10 dark:hover:text-white dark:focus-visible:ring-zinc-300"
        aria-label={isPlaying ? "Pausar" : "Tocar"}
      >
        {isPlaying ? (
          <PauseIcon className="w-5 h-5" aria-hidden="true" />
        ) : (
          <PlayIcon className="w-5 h-5" aria-hidden="true" />
        )}
      </button>

      <small className="min-w-[5.5rem] text-zinc-700 tabular-nums dark:text-zinc-300" aria-live="off">
        {formatTime(currentTime)} / {formatTime(Number.isFinite(duration) ? duration : 0)}
      </small>

      <div className="flex-1">
        <label htmlFor={`${controlId}-progress`} className="sr-only">Posição do áudio</label>
        <input
          id={`${controlId}-progress`}
          type="range"
          min="0"
          max={Number.isFinite(duration) ? duration : 0}
          value={currentTime}
          onChange={handleSeek}
          disabled={!duration}
          aria-valuetext={`${formatTime(currentTime)} de ${formatTime(duration)}`}
          className="h-8 w-full cursor-pointer accent-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 disabled:cursor-not-allowed disabled:opacity-50 dark:accent-zinc-100 dark:focus-visible:ring-zinc-300"
        />
      </div>

      <div className="hidden items-center gap-2 sm:flex">
        <label className="flex items-center text-xs text-zinc-600 dark:text-zinc-400" htmlFor={`${controlId}-volume`}>
          <SpeakerWaveIcon className="h-4 w-4" aria-hidden="true" />
          <span className="sr-only">Volume</span>
        </label>
        <input
          id={`${controlId}-volume`}
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={volume}
          onChange={(event) => setVolume(Number(event.target.value))}
          aria-valuetext={`${Math.round(volume * 100)}%`}
          className="h-8 w-20 cursor-pointer accent-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 dark:accent-zinc-100 dark:focus-visible:ring-zinc-300"
        />
      </div>

      <button
        type="button"
        className="grid size-10 place-items-center rounded-full text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-200/70 hover:text-zinc-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 disabled:cursor-not-allowed disabled:opacity-50 dark:text-zinc-300 dark:hover:bg-white/10 dark:hover:text-white dark:focus-visible:ring-zinc-300"
        aria-pressed={isBoosted}
        aria-label={boostAvailable === false ? "Boost de volume indisponível" : (isBoosted ? "Desativar boost de volume 2x" : "Ativar boost de volume 2x")}
        title={boostAvailable === false ? "Boost de volume indisponível" : (isBoosted ? "Desativar boost de volume 2x" : "Ativar boost de volume 2x")}
        disabled={boostAvailable === false}
        onClick={() => {
          if (ensureAudioGraph()) setIsBoosted((prev) => !prev)
        }}
      >
        {isBoosted ? (
          <BoltSolidIcon className="h-4 w-4" aria-hidden="true" />
        ) : (
          <BoltOutlineIcon className="h-4 w-4" aria-hidden="true" />
        )}
      </button>
      {error && (
        <p role="alert" className="basis-full text-xs text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
    </div>
  )
}
