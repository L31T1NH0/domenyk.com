"use client"

import { useEffect, useRef, useState } from "react"
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

  function togglePlayPause() {
    const audio = audioRef.current
    if (!audio) return

    if (isPlaying) {
      audio.pause()
      setIsPlaying(false)
      return
    }

    audioContextRef.current?.resume()
    audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false))
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

    const newTime = Number(event.target.value)
    audio.currentTime = newTime
    setCurrentTime(newTime)
  }

  useEffect(() => {
    const audio = audioRef.current
    if (!audio || typeof window === "undefined" || audioContextRef.current) return

    const AudioContextClass =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext

    if (!AudioContextClass) return

    const context = new AudioContextClass()
    const source = context.createMediaElementSource(audio)
    const gainNode = context.createGain()

    source.connect(gainNode)
    gainNode.connect(context.destination)

    audioContextRef.current = context
    gainNodeRef.current = gainNode
    sourceRef.current = source
  }, [audioUrl])

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume
    }

    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = volume * (isBoosted ? BOOST_MULTIPLIER : 1)
    }
  }, [volume, isBoosted])

  useEffect(() => {
    return () => {
      sourceRef.current?.disconnect()
      gainNodeRef.current?.disconnect()
      audioContextRef.current?.close()
    }
  }, [])

  const progress = duration && Number.isFinite(duration) ? (currentTime / duration) * 100 : 0

  return (
    <div className="w-full max-w-2xl mx-auto rounded-lg shadow-md flex items-center gap-3">
      <audio
        ref={audioRef}
        src={audioUrl}
        crossOrigin="anonymous"
        preload="metadata"
        onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime ?? 0)}
        onLoadedMetadata={updateDurationFromMetadata}
        onDurationChange={updateDurationFromMetadata}
        onEnded={() => setIsPlaying(false)}
        className="hidden"
      />

      <button
        type="button"
        onClick={togglePlayPause}
        className="text-zinc-700 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white rounded p-2"
        aria-label={isPlaying ? "Pausar" : "Tocar"}
      >
        {isPlaying ? (
          <PauseIcon className="w-5 h-5" aria-hidden="true" />
        ) : (
          <PlayIcon className="w-5 h-5" aria-hidden="true" />
        )}
      </button>

      <small className="text-zinc-700 dark:text-zinc-300">
        {formatTime(currentTime)} / {formatTime(Number.isFinite(duration) ? duration : 0)}
      </small>

      <div className="flex-1">
        <input
          type="range"
          min="0"
          max={Number.isFinite(duration) ? duration : 0}
          value={currentTime}
          onChange={handleSeek}
          className="h-2 w-full cursor-pointer appearance-none rounded-full bg-zinc-200 accent-zinc-800 dark:bg-zinc-700 dark:accent-zinc-100"
          style={{
            background: `linear-gradient(to right, #0F0F0F ${progress}%, #d4d4d8 ${progress}%)`,
          }}
        />
      </div>

      <div className="hidden items-center gap-2 sm:flex">
        <label className="flex items-center text-xs text-zinc-600 dark:text-zinc-400" htmlFor="volume-slider">
          <SpeakerWaveIcon className="h-4 w-4" aria-hidden="true" />
          <span className="sr-only">Volume</span>
        </label>
        <input
          id="volume-slider"
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={volume}
          onChange={(event) => setVolume(Number(event.target.value))}
          className="h-2 w-20 cursor-pointer appearance-none rounded-full bg-zinc-200 accent-zinc-800 dark:bg-zinc-700 dark:accent-zinc-100"
          style={{
            background: `linear-gradient(to right, #0F0F0F ${volume * 100}%, #d4d4d8 ${volume * 100}%)`,
          }}
        />
      </div>

      <button
        type="button"
        className="rounded px-2 py-1 text-xs font-medium text-zinc-700 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white"
        aria-label={isBoosted ? "Desativar boost de volume 2x" : "Ativar boost de volume 2x"}
        title={isBoosted ? "Desativar boost de volume 2x" : "Ativar boost de volume 2x"}
        onClick={() => setIsBoosted((prev) => !prev)}
      >
        {isBoosted ? (
          <BoltSolidIcon className="h-4 w-4" aria-hidden="true" />
        ) : (
          <BoltOutlineIcon className="h-4 w-4" aria-hidden="true" />
        )}
      </button>
    </div>
  )
}
