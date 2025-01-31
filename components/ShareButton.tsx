import React, { useState } from 'react';

interface ShareButtonProps {
  id: string;
}

const ShareButton: React.FC<ShareButtonProps> = ({ id }) => {
  const [shortUrl, setShortUrl] = useState('');

  const copyToClipboard = async () => {
    const url = `https://blog-roan-nu.vercel.app/posts/${id}`;
    console.log(`URL original: ${url}`);

    const savedShortUrl = localStorage.getItem(`shortUrl-${id}`);
    if (savedShortUrl) {
      console.log(`URL encurtada recuperada do localStorage: ${savedShortUrl}`);
      setShortUrl(savedShortUrl);
      navigator.clipboard.writeText(savedShortUrl).then(() => {
        console.log('Link copiado para a área de transferência!');
      }).catch(err => {
        console.error('Erro ao copiar o link:', err);
      });
      return;
    }

    try {
      const response = await fetch(`/api/posts/shorten-url?url=${encodeURIComponent(url)}`);
      console.log(`Requisição feita para: /api/posts/shorten-url?url=${encodeURIComponent(url)}`);
      const shortUrl = await response.text(); // Tratar a resposta como texto
      console.log(`Resposta recebida: ${shortUrl}`);
      if (shortUrl.startsWith('http')) {
        setShortUrl(shortUrl);
        localStorage.setItem(`shortUrl-${id}`, shortUrl);
        navigator.clipboard.writeText(shortUrl).then(() => {
          console.log('Link copiado para a área de transferência!');
        }).catch(err => {
          console.error('Erro ao copiar o link:', err);
        });
      } else {
        throw new Error('Erro ao encurtar a URL');
      }
    } catch (error) {
      console.error('Erro ao encurtar a URL:', error);
    }
  };

  return (
    <button onClick={copyToClipboard} className="ml-0 text-sm 
    text-cyan-600 active:text-cyan-700 
    focus:text-cyan-600 hover:text-cyan-700">
      Compartilhar
    </button>
  );
};

export default ShareButton;