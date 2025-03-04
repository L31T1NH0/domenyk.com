"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { NextSeo } from "next-seo";
import { Date } from "@components/date";
import { Layout } from "@components/layout";
import Views from "@components/views"; // Certifique-se de que o caminho está correto

type PostData = {
  postId: string;
  title: string;
  date: string;
  views: number;
};

export default function Home() {
  console.log("Home component rendering..."); // Log para depuração
  const router = useRouter();
  const [posts, setPosts] = useState<PostData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log("useEffect called in Home component...");
    const fetchPosts = async () => {
      try {
        setLoading(true);
        const response = await fetch("/api/posts");
        if (!response.ok) {
          const errorText = await response.text(); // Obtém o texto do erro para depuração
          console.warn(
            `Erro ao buscar posts: ${response.status} - ${errorText}`
          );
          setPosts([]); // Define posts como array vazio em caso de erro 404
          setError(
            `Não foi possível carregar os posts: ${response.status} - ${errorText}`
          );
        } else {
          const postsData = await response.json();
          console.log("Posts recebidos da API:", postsData);
          setPosts(postsData || []); // Garante que posts seja um array, mesmo se vazio
        }
      } catch (error) {
        console.error("Erro ao carregar posts:", error);
        setError(`Falha ao carregar os posts: ${(error as Error).message}`);
        setPosts([]); // Define posts como array vazio em caso de erro de rede
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
                    <span className="text-sm text-zinc-500 p-1">
                      {/* <Views views={post.views} /> */}
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
