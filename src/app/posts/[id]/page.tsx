"use client"; // Marca como Client Component

import { useEffect, useState } from "react";

import { useRouter } from "next/navigation";
import { Layout } from "@components/layout";
import { Date } from "@components/date";
import ShareButton from "@components/ShareButton";
import Comment from "@components/Comment";
import { BackHome } from "@components/back-home";
import { NextSeo, ArticleJsonLd } from "next-seo";
import { use } from "react"; // Importe o use do React

type PostContent = {
  postId: string;
  date: string;
  title: string;
  htmlContent: string;
  views: number;
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
  const router = useRouter();
  // Use React.use() para desestruturar params.id com o tipo correto
  const { id } = use(params) as { id: string }; // Corrigido para usar React.use(params)
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
        ); // Log mais detalhado
        const response = await fetch(`/api/posts/${id}`);
        if (!response.ok) {
          const errorText = await response.text(); // Obtém o texto do erro para depuração
          throw new Error(
            `Erro ao buscar post: ${response.status} - ${errorText}`
          );
        }
        const data = await response.json();
        console.log("Post data from API (raw):", data); // Log mais detalhado
        if (!data || typeof data !== "object" || !data.postId) {
          throw new Error("Dados do post inválidos retornados pela API");
        }
        // Verifique se htmlContent é uma string válida
        if (typeof data.htmlContent !== "string") {
          console.warn("htmlContent inválido ou ausente:", data.htmlContent);
          data.htmlContent = "<p>Conteúdo não disponível.</p>"; // Fallback
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
    return null; // Não renderiza nada até que os dados estejam disponíveis
  }

  const { date, title, htmlContent, views } = postData;
  const path = `/posts/${id}`;
  const readingTime = calculateReadingTime(htmlContent);

  if (typeof window === "undefined") return null; // Evita erros de hooks no SSR

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
        type="BlogPosting"
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
        <article className="flex flex-col gap-2 py-4">
          <h1 className="lg:text-3xl max-sm:text-xl font-bold">{title}</h1>
          <div className="flex gap-2">
            <Date dateString={date} />
            <div>
              <span className="text-sm text-zinc-500">• {readingTime}</span>
              <span className="text-sm text-zinc-500 p-1">
                {views || 0} views
              </span>
            </div>
          </div>
          <div>
            <ShareButton id={id} />
          </div>
          <div
            className="flex flex-col gap-4 lg:text-lg sm:text-sm max-sm:text-xs"
            dangerouslySetInnerHTML={{
              __html: htmlContent || "<p>Conteúdo não disponível.</p>",
            }}
          />
        </article>

        <BackHome />

        <Comment postId={postData.postId} />
      </Layout>
    </>
  );
}
