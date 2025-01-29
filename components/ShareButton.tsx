import React, { useState } from 'react';

interface ShareButtonProps {
  id: string;
}

const ShareButton: React.FC<ShareButtonProps> = ({ id }) => {
  const [shortUrl, setShortUrl] = useState('');

  const copyToClipboard = async () => {
    const url = `https://blog-roan-nu.vercel.app/posts/${id}`;
    console.log(`URL original: ${url}`);
    try {
      const response = await fetch(`/api/posts/shorten-url?url=${encodeURIComponent(url)}`);
      console.log(`Requisição feita para: /api/posts/shorten-url?url=${encodeURIComponent(url)}`);
      const shortUrl = await response.text(); // Tratar a resposta como texto
      console.log(`Resposta recebida: ${shortUrl}`);
      if (shortUrl.startsWith('http')) {
        setShortUrl(shortUrl);
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
    <button onClick={copyToClipboard} className="ml-2 text-sm text-blue-500 hover:underline">
      Compartilhar
    </button>
  );
};

export default ShareButton;