"use client"; // Marca como Client Component

import { useEffect, useState } from "react";
type Params = {
  [key: string]: string | string[];
};
import { useRouter } from "next/navigation";
import { Layout } from "@components/layout";
import { Date } from "@components/date";
import ShareButton from "@components/ShareButton";
import Comment from "@components/Comment";
import { BackHome } from "@components/back-home";
import { NextSeo, ArticleJsonLd } from "next-seo";
import { use } from "react"; // Importe o use do React
import Skeleton from "react-loading-skeleton"; // Importe o Skeleton
import "react-loading-skeleton/dist/skeleton.css"; // Importe o CSS padrão

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPost = async () => {
      try {
        setLoading(true);
        console.log(
          "Tentando buscar post para postId:",
          id,
          "URL:",
          `/api/posts/${id}`
        ); // Log mais detalhado
        const response = await fetch(`/api/posts/${id}`, { cache: "no-store" }); // Evita caching para garantir dados frescos
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
      } finally {
        setLoading(false);
      }
    };

    fetchPost();
  }, [id]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="w-full max-w-2xl">
          <article className="flex flex-col gap-2 py-4">
            <h1 className="lg:text-3xl max-sm:text-xl font-bold">
              <Skeleton width="100%" height={40} /> {/* Título do post */}
            </h1>
            <div className="flex gap-2">
              <Skeleton width={100} height={16} /> {/* Data */}
              <div>
                <Skeleton width={100} height={16} /> {/* Reading Time */}
                <Skeleton width={60} height={16} className="p-1" />{" "}
                {/* Views */}
              </div>
            </div>
            <div>
              <Skeleton width={120} height={32} /> {/* ShareButton */}
            </div>
            <div>
              {/* Conteúdo da página */}
              {Array.from({ length: 10 }).map((_, index) => (
                <div key={index}>{/* Linhas do conteúdo */}</div>
              ))}
            </div>
          </article>
          <div>
            <Skeleton width={100} height={32} /> {/* BackHome */}
          </div>
          <div className="mt-6">
            <h1 className="text-xl font-bold mb-4 max-sm:text-lg max-sm:mb-2">
              <Skeleton width="100%" height={24} />{" "}
              {/* Título dos comentários */}
            </h1>
            <div className="flex flex-col gap-4 max-sm:gap-2">
              <div className="flex gap-4 max-sm:flex-col max-sm:gap-2">
                <Skeleton width="100%" height={32} /> {/* Input de nome */}
                <Skeleton width="100%" height={32} /> {/* Botão de enviar */}
              </div>
              <Skeleton width="100%" height={200} />{" "}
              {/* Textarea de comentário */}
            </div>
            <div className="mt-6 max-sm:mt-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={index}
                  className="bg-zinc-700 p-3 rounded-lg mb-4 max-sm:p-2 max-sm:mb-2 max-sm:rounded-md flex flex-col gap-2 max-sm:gap-1 items-start"
                >
                  <div className="flex gap-4 max-sm:gap-2 items-start">
                    <Skeleton width={32} height={32} circle={true} />{" "}
                    {/* Avatar */}
                    <div className="flex-1">
                      <div className="flex gap-2 max-sm:gap-1">
                        <Skeleton width={100} height={16} /> {/* Nome */}
                        <Skeleton width={80} height={14} /> {/* Data */}
                      </div>
                      <Skeleton width="100%" height={16} /> {/* Comentário */}
                      <Skeleton width={80} height={14} />{" "}
                      {/* Botão "Responder" */}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center h-screen">{error}</div>
    );
  }

  if (!postData) {
    return (
      <div className="flex justify-center items-center h-screen">
        Post não encontrado (404)
      </div>
    );
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
          url: `https://blog-roan-nu.vercel.app${path}`,
        }}
        twitter={{ handle: "@l31t1" }}
      />
      <ArticleJsonLd
        type="BlogPosting"
        url={`https://blog-roan-nu.vercel.app${path}`}
        title={title}
        images={[
          "https://blog-roan-nu.vercel.app/_next/image?url=%2Fimages%2Fprofile.jpg&w=256&q=75",
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
              <span className="text-sm text-zinc-500">
                • {readingTime}
              </span>
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
        <div>
          <BackHome />
        </div>
        <Comment postId={postData.postId} />
      </Layout>
    </>
  );
}
