"use client";

import React, { useState, useEffect } from "react";

interface ShareButtonProps {
  id: string;
}

const ShareButton: React.FC<ShareButtonProps> = ({ id }) => {
  const [shortUrl, setShortUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {}, []);

  const copyToClipboard = async () => {
    if (typeof window === "undefined") return;

    const url = `https://domenyk.com/posts/${id}`;
    console.log(`URL original: ${url}`);

    const savedShortUrl = localStorage.getItem(`shortUrl-${id}`);
    if (savedShortUrl) {
      console.log(`URL encurtada recuperada do localStorage: ${savedShortUrl}`);
      setShortUrl(savedShortUrl);
      await navigator.clipboard.writeText(savedShortUrl);
      console.log("Link copiado para a área de transferência!");
      return;
    }

    try {
      const response = await fetch(
        `/api/posts/shorten-url?url=${encodeURIComponent(url)}`,
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
      console.log(`Status da resposta: ${response.status}`);
      if (!response.ok) {
        throw new Error(`Falha na requisição da API: ${response.status}`);
      }
      const shortUrl = await response.text();
      console.log(`Resposta recebida: ${shortUrl}`);
      if (shortUrl.startsWith("http")) {
        setShortUrl(shortUrl);
        localStorage.setItem(`shortUrl-${id}`, shortUrl);
        await navigator.clipboard.writeText(shortUrl);
        console.log("Link copiado para a área de transferência!");
      } else {
        throw new Error("URL encurtada inválida");
      }
    } catch (error) {
      console.error("Erro ao encurtar a URL:", error);
      setError("Não foi possível encurtar o link. Tente novamente.");
    }
  };

  return (
    <div>
      <button
        onClick={copyToClipboard}
        className="ml-0 text-sm text-cyan-600 active:text-cyan-700 focus:text-cyan-600 hover:text-cyan-700"
      >
        Compartilhar
      </button>
      {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
    </div>
  );
};

export default ShareButton;
