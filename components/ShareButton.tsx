"use client";

import React, { useState, useEffect } from "react";
import { ShareIcon } from "@heroicons/react/24/outline";

interface ShareButtonProps {
  id: string;
}

const ShareButton: React.FC<ShareButtonProps> = ({ id }) => {
  const [shortUrl, setShortUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {}, []);

  const share = async () => {
    if (typeof window === "undefined") return;

    setError(null);
    const url = `https://domenyk.com/posts/${id}`;

    try {
      let finalUrl = localStorage.getItem(`shortUrl-${id}`) || "";
      if (!finalUrl) {
        const response = await fetch(
          `/api/posts/shorten-url?url=${encodeURIComponent(url)}`,
          { headers: { "Content-Type": "application/json" } }
        );
        if (!response.ok) {
          throw new Error(`Falha na requisição da API: ${response.status}`);
        }
        finalUrl = await response.text();
        if (!finalUrl || !finalUrl.startsWith("http")) {
          throw new Error("URL encurtada inválida");
        }
        localStorage.setItem(`shortUrl-${id}`, finalUrl);
      }

      setShortUrl(finalUrl);
      await navigator.clipboard.writeText(finalUrl);
      setNotice("Link copiado!");
      setTimeout(() => setNotice(null), 2000);
    } catch (e) {
      console.error("Erro ao encurtar/copiar a URL:", e);
      setError("Não foi possível encurtar/copiar o link. Tente novamente.");
    }
  };

  return (
    <div>
      <button
        onClick={share}
        aria-label="Compartilhar"
        className="ml-0 inline-flex shrink-0 items-center justify-center gap-1 sm:gap-2 h-7 w-7 p-0 sm:h-auto sm:w-auto sm:px-2 sm:py-1.5 text-xs sm:text-sm font-medium text-cyan-600 hover:text-cyan-700 active:text-cyan-700 rounded-full border border-transparent hover:border-cyan-200/60 dark:hover:border-cyan-800/60 hover:bg-cyan-50 dark:hover:bg-cyan-950/40 transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
      >
        {/* Icon only on mobile */}
        <ShareIcon className="block h-3 w-3 sm:hidden" aria-hidden="true" />
        {/* Text on sm and up */}
        <span className="hidden sm:inline">Compartilhar</span>
      </button>
      {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
      {notice && (
        <div
          role="status"
          className="fixed left-1/2 -translate-x-1/2 bottom-4 z-50 inline-flex items-center rounded-full border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 shadow-md dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        >
          {notice}
        </div>
      )}
    </div>
  );
};

export default ShareButton;
