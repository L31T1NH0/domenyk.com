"use client"; // Marca como Client Component

import { useEffect, useState } from "react";
import { Layout } from "@components/layout";
import { Date } from "@components/date";
import ShareButton from "@components/ShareButton";
import Comment from "@components/Comment";
import { BackHome } from "@components/back-home";
import { NextSeo, ArticleJsonLd } from "next-seo";
import { use } from "react"; // Importe o use do React
import AudioPlayer from "@components/AudioPlayer"; // Importe o AudioPlayer
import Chatbot from "@components/Chatbot"; // Importe o componente Chatbot
import { PostHeader } from "@components/PostHeader"; // Novo componente

type PostContent = {
  postId: string;
  date: string;
  title: string;
  htmlContent: string;
  views: number;
  audioUrl?: string;
  cape?: string; // Campo opcional para link de imagem
  friendImage?: string; // Novo campo para a foto do amigo
};

// Use Awaited<Params> para tipar params corretamente, pois params pode ser uma Promise
type PostParams = {
  params: Promise<{ id: string }>; // Ajustado para indicar que params é uma Promise que resolve para { id: string }
};

function calculateReadingTime(htmlContent: string): string {
  const wordsPerMinute = 200;
  const text = htmlContent.replace(/<[^>]+>/g, "");
  const words = text.split(/\s+/).length;
  const minutes = Math.ceil(words / wordsPerMinute);
  return `${minutes} min`;
}

export default function Post({ params }: PostParams) {
  const { id } = use(params) as { id: string };
  const [postData, setPostData] = useState<PostContent | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPost = async () => {
      try {
        console.log(
          "Tentando buscar post para postId:",
          id,
          "URL:",
          `/api/posts/${id}`
        );
        const response = await fetch(`/api/posts/${id}`);
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(
            `Erro ao buscar post: ${response.status} - ${errorText}`
          );
        }
        const data = await response.json();
        console.log("Post data from API (raw):", data); // Debug para verificar todos os dados
        if (!data || typeof data !== "object" || !data.postId) {
          throw new Error("Dados do post inválidos retornados pela API");
        }
        if (typeof data.htmlContent !== "string") {
          console.warn("htmlContent inválido ou ausente:", data.htmlContent);
          data.htmlContent = "<p>Conteúdo não disponível.</p>";
        }
        setPostData(data);
      } catch (error) {
        console.error("Erro ao carregar post para postId:", id, error);
        setError("Falha ao carregar o post. Tente novamente mais tarde.");
      }
    };

    fetchPost();
  }, [id]);

  if (error) {
    return (
      <div className="flex justify-center items-center h-screen">{error}</div>
    );
  }

  if (!postData) {
    return null;
  }

  const { date, title, htmlContent, views, audioUrl, cape, friendImage } = postData;
  const path = `/posts/${id}`;
  const readingTime = calculateReadingTime(htmlContent);

  if (typeof window === "undefined") return null;

  return (
    <>
      <NextSeo
        title={`${title} - Blog`}
        description={title}
        openGraph={{
          title: title,
          description: title,
          url: `https://domenyk.com${path}`,
        }}
        twitter={{ handle: "@l31t1" }}
      />
      <ArticleJsonLd
        type="Blog"
        url={`https://domenyk.com${path}`}
        title={title}
        images={[
          "https://img.clerk.com/eyJ0eXBlIjoicHJveHkiLCJzcmMiOiJodHRwczovL2ltYWdlcy5jbGVyay5kZXYvdXBsb2FkZWQvaW1nXzJ0dHoxemhpRmFacHdvbVFGdHNpdGhaYkk3eiJ9",
        ]}
        datePublished={date}
        dateModified={date}
        authorName="Domenyk"
        description={title}
      />
      <Layout title={title} description={title} url={path}>
        <PostHeader cape={cape} title={title} friendImage={friendImage} />
        <article className="flex flex-col gap-2">
          <div className="mb-2 flex-1">
            <div className="flex gap-2 items-center">
              <Date dateString={date} />
              <div className="flex gap-2 text-sm text-zinc-500">
                <span>• {readingTime}</span>
                <span>{views || 0} views</span>
              </div>
            </div>
            <div className="">
              <ShareButton id={id} />
            </div>
          </div>

          {/* Usar o componente AudioPlayer */}
          {audioUrl && <AudioPlayer audioUrl={audioUrl} />}

          <div
            className="flex flex-col gap-4 lg:text-lg sm:text-sm max-sm:text-xs"
            dangerouslySetInnerHTML={{
              __html: htmlContent || "<p>Conteúdo não disponível.</p>",
            }}
          />

          {/* Passar o htmlContent para o Chatbot (comentado por enquanto) */}
          {/* <Chatbot htmlContent={htmlContent} /> */}
        </article>

        <BackHome />

        <Comment postId={postData.postId} />
      </Layout>
    </>
  );
}
