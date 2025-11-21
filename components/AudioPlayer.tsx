"use client"; // Marca como Client Component

import { useState, useRef, useEffect, useMemo } from "react";
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
  const audioContextRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const boostLevels = useMemo(() => [1, 1.5, 2], []);
  const [boostIndex, setBoostIndex] = useState(0);

  // Funções para controlar o áudio
  const togglePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioContextRef.current?.resume();
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

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = Number(e.target.value);
    setVolume(newVolume);
  };

  const handleBoostToggle = () => {
    setBoostIndex((prev) => (prev + 1) % boostLevels.length);
  };

  useEffect(() => {
    if (!audioRef.current || typeof window === "undefined") return;

    if (!audioContextRef.current) {
      const AudioContextClass =
        window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

      if (!AudioContextClass) return;

      const context = new AudioContextClass();
      const source = context.createMediaElementSource(audioRef.current);
      const gainNode = context.createGain();

      source.connect(gainNode);
      gainNode.connect(context.destination);

      audioContextRef.current = context;
      gainNodeRef.current = gainNode;
      sourceRef.current = source;
    }
  }, [audioUrl]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }

    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = volume * boostLevels[boostIndex];
    }
  }, [volume, boostIndex, boostLevels]);

  useEffect(() => {
    return () => {
      sourceRef.current?.disconnect();
      gainNodeRef.current?.disconnect();
      audioContextRef.current?.close();
    };
  }, []);

  return (
    <div className={`w-full max-w-2xl mx-auto rounded-lg shadow-md flex items-center gap-4`}>
      {/* Elemento de áudio oculto para controle */}
      <audio
        ref={audioRef}
        src={audioUrl}
        crossOrigin="anonymous"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => setIsPlaying(false)}
        className="hidden"
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
          className="w-full h-2 rounded-full appearance-none cursor-pointer progress-thumb"
          style={{
            background: `linear-gradient(to right, #0F0F0F ${
              (currentTime / duration) * 100
            }%, #1F1F1F ${(currentTime / duration) * 100}%)`,
          }}
        />
      </div>

      <div className="flex items-center gap-2">
        <label className="text-xs text-zinc-600 dark:text-zinc-400" htmlFor="volume-slider">
          Volume
        </label>
        <input
          id="volume-slider"
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={volume}
          onChange={handleVolumeChange}
          className="w-24 h-2 rounded-full appearance-none cursor-pointer"
        />
      </div>

      <button
        onClick={handleBoostToggle}
        className="text-xs font-medium text-zinc-700 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white rounded px-2 py-1 border border-zinc-200 dark:border-zinc-700"
      >
        Boost x{boostLevels[boostIndex].toFixed(1)}
      </button>

      <style jsx>{`
        .progress-thumb::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          height: 14px;
          width: 14px;
          border-radius: 9999px;
          background: #f4f4f5;
          border: 2px solid #0f0f0f;
          box-shadow: 0 0 0 6px rgba(15, 15, 15, 0.08);
        }

        .progress-thumb::-moz-range-thumb {
          height: 14px;
          width: 14px;
          border-radius: 9999px;
          background: #f4f4f5;
          border: 2px solid #0f0f0f;
          box-shadow: 0 0 0 6px rgba(15, 15, 15, 0.08);
        }

        @media (prefers-color-scheme: dark) {
          .progress-thumb::-webkit-slider-thumb {
            background: #0f0f0f;
            border-color: #e4e4e7;
            box-shadow: 0 0 0 6px rgba(228, 228, 231, 0.12);
          }

          .progress-thumb::-moz-range-thumb {
            background: #0f0f0f;
            border-color: #e4e4e7;
            box-shadow: 0 0 0 6px rgba(228, 228, 231, 0.12);
          }
        }
      `}</style>
    </div>
  );
}
