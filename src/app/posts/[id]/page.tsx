<<<<<<< HEAD
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { unstable_cache } from "next/cache";
=======
"use client"; // Marca como Client Component

import { useEffect, useState } from "react";
>>>>>>> parent of ab2cc0b (Refactor home and post pages for server rendering)
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

<<<<<<< HEAD
const loadPostById = unstable_cache(
  async (id: string) => {
    try {
      const { getMongoDb } = await import("../../../lib/mongo");
      const db = await getMongoDb();
      return db.collection<PostDocument>("posts").findOne(
        { postId: id },
        {
          projection: {
            _id: 0,
            postId: 1,
            date: 1,
            title: 1,
            htmlContent: 1,
            content: 1,
            views: 1,
            audioUrl: 1,
            cape: 1,
            friendImage: 1,
          },
        }
      );
    } catch (error) {
      console.error(`Failed to fetch post ${id}:`, error);
      return null;
    }
  },
  ["post-by-id"],
  { revalidate: 60 }
);

function normalizeDate(date?: string | Date): string {
  if (typeof date === "string") {
    return date;
  }
  if (date instanceof Date) {
    return date.toISOString();
  }
  return "";
}

=======
>>>>>>> parent of ab2cc0b (Refactor home and post pages for server rendering)
function calculateReadingTime(htmlContent: string): string {
  const wordsPerMinute = 200;
  const text = htmlContent.replace(/<[^>]+>/g, "");
  const words = text.split(/\s+/).length;
  const minutes = Math.ceil(words / wordsPerMinute);
  return `${minutes} min`;
}

<<<<<<< HEAD
export async function generateMetadata({ params }: PostPageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const id = resolvedParams?.id;
  if (!id) {
    return {
      title: "Post não encontrado",
    };
  }

  const post = await loadPostById(id);

  if (!post) {
    return {
      title: "Post não encontrado",
    };
  }

  const title = post.title ?? "";
  const date = normalizeDate(post.date);
  const url = `https://domenyk.com/posts/${id}`;

  return {
    title: `${title} - Blog`,
    description: title,
    openGraph: {
      title,
      description: title,
      url,
    },
    twitter: {
      site: "@l31t1",
      card: "summary_large_image",
    },
    other: {
      "article:published_time": date,
      "article:modified_time": date,
    },
  };
}

export async function generateStaticParams() {
  try {
    const { getMongoDb } = await import("../../../lib/mongo");
    const db = await getMongoDb();
    const posts = await db
      .collection<{ postId: string }>("posts")
      .find(
        {},
        {
          projection: { _id: 0, postId: 1 },
=======
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
>>>>>>> parent of ab2cc0b (Refactor home and post pages for server rendering)
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

<<<<<<< HEAD
  const post = await loadPostById(id);

  if (!post) {
    notFound();
=======
  if (!postData) {
    return null;
>>>>>>> parent of ab2cc0b (Refactor home and post pages for server rendering)
  }

  const { date, title, htmlContent, views, audioUrl, cape, friendImage } = postData;
  const path = `/posts/${id}`;
  const readingTime = calculateReadingTime(htmlContent);
<<<<<<< HEAD
  const dateString = normalizeDate(post.date);
  const views = typeof post.views === "number" ? post.views : 0;
  const path = `/posts/${post.postId}`;
=======

  if (typeof window === "undefined") return null;
>>>>>>> parent of ab2cc0b (Refactor home and post pages for server rendering)

  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: title,
    datePublished: dateString,
    dateModified: dateString,
    author: {
      '@type': 'Person',
      name: 'Domenyk',
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `https://domenyk.com${path}`,
    },
  };

  return (
<<<<<<< HEAD
    <Layout title={title} description={title} url={path}>
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
=======
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
>>>>>>> parent of ab2cc0b (Refactor home and post pages for server rendering)
      />
      <PostHeader
        cape={post.cape}
        title={title}
<<<<<<< HEAD
        friendImage={post.friendImage}
      />
      <PostContentClient
        postId={post.postId}
        date={dateString}
        htmlContent={htmlContent}
        initialViews={views}
        audioUrl={post.audioUrl}
        readingTime={readingTime}
      />
      <BackHome />
      <Comment postId={post.postId} />
    </Layout>
=======
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
>>>>>>> parent of ab2cc0b (Refactor home and post pages for server rendering)
  );
}
