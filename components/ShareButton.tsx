"use client";

import React, { useState } from "react";

interface ShareButtonProps {
  id: string;
}

const ShareButton: React.FC<ShareButtonProps> = ({ id }) => {
  const [error, setError] = useState<string | null>(null);

  const copyToClipboard = async () => {
    if (typeof window === "undefined") return;

    const url = `https://domenyk.com/posts/${id}`;

    const savedShortUrl = localStorage.getItem(`shortUrl-${id}`);
    if (savedShortUrl) {
      await navigator.clipboard.writeText(savedShortUrl);
      return;
    }

    try {
      const response = await fetch(`/api/posts/shorten-url?url=${encodeURIComponent(url)}`, {
        headers: {
          "Content-Type": "application/json",
        },
      });
      if (!response.ok) {
        throw new Error(`Falha na requisição da API: ${response.status}`);
      }
      const shortUrl = await response.text();
      if (shortUrl.startsWith("http")) {
        localStorage.setItem(`shortUrl-${id}`, shortUrl);
        await navigator.clipboard.writeText(shortUrl);
      } else {
        throw new Error("URL encurtada inválida");
      }
    } catch (error) {
      console.error("Erro ao encurtar a URL:", error);
      setError("Não foi possível encurtar o link. Tente novamente.");
    }
  };

  return (
    <div className="flex flex-col items-center gap-1 text-[0.68rem]">
      <button
        onClick={copyToClipboard}
        className="motion-scale inline-flex items-center gap-2 rounded-full border border-[rgba(255,75,139,0.4)] bg-[rgba(255,75,139,0.15)] px-4 py-1.5 text-[0.68rem] uppercase tracking-[0.32em] text-white transition hover:bg-[rgba(255,75,139,0.28)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
      >
        Compartilhar
      </button>
      {error && <p className="text-[0.6rem] text-[var(--color-muted)]">{error}</p>}
    </div>
  );
};

export default ShareButton;
