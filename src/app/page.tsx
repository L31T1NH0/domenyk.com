// home page
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { NextSeo } from "next-seo";
import { Date } from "@components/date";
import { Layout } from "@components/layout";

type PostData = {
  postId: string;
  title: string;
  date: string;
  views: number;
};


export default function Home() {
  const router = useRouter();
  const [posts, setPosts] = useState<PostData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPosts = async () => {
      try {
        setLoading(true);
        const response = await fetch("/api/posts", { cache: "no-store" }); // Evita caching para garantir dados frescos
        if (!response.ok) {
          const errorText = await response.text();
          console.warn(
            `Erro ao buscar posts: ${response.status} - ${errorText}`
          );
          setPosts([]);
          setError(
            `Não foi possível carregar os posts: ${response.status} - ${errorText}`
          );
        } else {
          const postsData = await response.json();
          console.log("Posts recebidos da API:", postsData);
          setPosts(postsData || []);
        }
      } catch (error) {
        console.error("Erro ao carregar posts:", error);
        setError(`Falha ao carregar os posts: ${(error as Error).message}`);
        setPosts([]);
      } finally {
        setLoading(false);
      }
    };

    fetchPosts();
  }, []);

  const handlePostClick = (postId: string, e: React.MouseEvent) => {
    e.preventDefault();
    router.push(`/posts/${postId}`);
  };

  // Verifica se o usuário é admin com base nas claims do Clerk
  if (typeof window === "undefined") return null; // Evita erros de hooks no SSR

  return (
    <>
      <NextSeo
        title="Domenyk - Blog"
        description="Leia minhas opiniões."
        openGraph={{
          title: "Domenyk - Blog",
          description: "Leia minhas opiniões.",
          url: "https://blog-roan-nu.vercel.app",
        }}
        twitter={{
          handle: "@l31t1",
          cardType: "summary_large_image",
        }}
      />
      <Layout home>
        <section className="text-xl flex flex-col gap-2 py-4 text-primary items-center">
          <h1>Dou minhas opiniões aqui</h1>
        </section>
        <section className="flex flex-col gap-4">
          <h1 className="font-bold text-2xl">Blog</h1>

          <ul className="text-xl ml-0 flex flex-col gap-4">
            {posts.map((post) => (
              <li key={post.postId} className="flex flex-col gap-2">
                <a
                  href={`/posts/${post.postId}`}
                  onClick={(e) => handlePostClick(post.postId, e)}
                  className="text-xl hover:underline"
                >
                  {post.title}
                </a>
                <small className="text-zinc-400">
                  <Date dateString={post.date} /> •{" "}
                  <span className=" text-zinc-400 p-0.5">
                    {post.views || 0} views
                  </span>
                </small>
              </li>
            ))}
          </ul>
        </section>
      </Layout>
    </>
  );
}
