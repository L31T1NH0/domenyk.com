"use client"; // Marca como Client Component

import { useState, useRef, useEffect } from "react";
import { PlayIcon, PauseIcon } from "@heroicons/react/20/solid";

// Props do componente AudioPlayer
type AudioPlayerProps = {
  audioUrl: string;
};

// Função para formatar o tempo (ex.: 00:51)
function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

export default function AudioPlayer({ audioUrl }: AudioPlayerProps) {
  // Estados para o player de áudio
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Funções para controlar o áudio
  const togglePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (audioRef.current) {
      const newTime = Number(e.target.value);
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto rounded-lg shadow-md flex
                    items-center gap-4">
      {/* Elemento de áudio oculto para controle */}
      <audio
        ref={audioRef}
        src={audioUrl}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        className="hidden"
        preload="metadata"
      />

      {/* Botão de play/pause */}
      <button
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

      {/* Contador de tempo */}
      <small className="text-zinc-700 dark:text-zinc-300">
        {formatTime(currentTime)} / {formatTime(duration)}
      </small>

      {/* Barra de progresso estilizada como "espectro" */}
      <div className="flex-1">
        <input
          type="range"
          min="0"
          max={duration || 0}
          value={currentTime}
          onChange={handleSeek}
          className="w-full h-2 rounded-full appearance-none cursor-pointer"
          style={{
            background: `linear-gradient(to right, #0F0F0F ${
              (currentTime / duration) * 100
            }%, #1F1F1F ${(currentTime / duration) * 100}%)`,
          }}
        />
      </div>
    </div>
  );
}
