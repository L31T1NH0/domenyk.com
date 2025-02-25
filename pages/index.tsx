import { GetServerSideProps } from "next";
import Link from "next/link";
import { Layout } from "@components/layout";
import { Date } from "@components/date";
import axios, { AxiosResponse } from "axios"; // Importe AxiosResponse
import { JSX } from "react";
import { useRouter } from "next/router"; // Importe useRouter do next/router
import { useEffect } from "react"; // Importe useEffect do react
import clientPromise from "../lib/mongo";
import { Views } from "@components/views";
import { useViews, ViewResponse } from "../lib/viewsManager"; // Importe ViewResponse
import { NextSeo } from "next-seo"; // Importe NextSeo para SEO

type PostData = {
  postId: string; // Usamos postId para consistência com o MongoDB
  date: string;
  title: string;
  views: number; // Visualizações do post
};

type HomeProps = {
  allPostsData: PostData[];
  error: string | null;
};

export default function Home({ allPostsData, error }: HomeProps): JSX.Element {
  const router = useRouter();

  // Use useViews no topo do componente para cada post (usamos um objeto para armazenar as funções por postId)
  const viewsManagers = allPostsData.reduce((acc, post) => {
    acc[post.postId] = useViews(post.postId, post.views); // Use postId em vez de id
    return acc;
  }, {} as Record<string, ReturnType<typeof useViews>>);

  // Use useEffect para garantir que o router só seja usado no cliente
  useEffect(() => {
    console.log("Router mounted on client:", router);
  }, [router]);

  const handlePostClick = async (postId: string, e: React.MouseEvent) => {
    e.preventDefault();
    console.log("Sending request to /api/posts/view with postId:", postId);
    try {
      const { updateViews } = viewsManagers[postId]; // Acesse updateViews para o postId específico
      const response: AxiosResponse<ViewResponse> = await updateViews(); // Chama updateViews manualmente ao clicar
      console.log("Response from backend (via handlePostClick):", {
        message: "View updated or checked",
        headers: response.headers["set-cookie"] || "No cookie set",
        data: response.data,
      });
      router.push(`/posts/${postId}`); // Usa postId para redirecionar corretamente
    } catch (error: any) {
      console.error("Failed to update post view count. Error details:", {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
        headers: error.response?.headers,
      });
      router.push(`/posts/${postId}`); // Redireciona mesmo em caso de erro, usando postId
    }
  };

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
    <>
      <NextSeo
        title="Domenyk - Blog"
        description="Leia minhas opiniões e insights no meu blog pessoal."
        openGraph={{
          title: "Dou minhas opiniões aqui - Blog",
          description: "Leia minhas opiniões e insights no meu blog pessoal.",
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
          <div className="flex gap-1">
            <h1 className="font-bold text-2xl">Blog</h1>
          </div>
          <ul className="text-xl ml-0 flex flex-col gap-4">
            {allPostsData.map(({ postId, date, title, views }) => (
              <li className="flex flex-col gap-2" key={postId}>
                <Link href={`/posts/${postId}`} legacyBehavior>
                  <a onClick={(e) => handlePostClick(postId, e)}>{title}</a>
                </Link>
                <small className="text-zinc-400">
                  <Date dateString={date} />{" "}
                  <Views views={useViews(postId, views).views} />{" "}
                  {/* Passa as views iniciais usando postId */}
                </small>
              </li>
            ))}
          </ul>
        </section>
      </Layout>
    </>
  );
}

export const getServerSideProps: GetServerSideProps = async () => {
  try {
    const client = await clientPromise;
    const database = client.db("blog");
    const postsCollection = database.collection("posts");

    const posts = await postsCollection
      .find(
        {},
        { projection: { postId: 1, date: 1, title: 1, views: 1, _id: 0 } }
      )
      .sort({ date: -1 })
      .toArray();

    const allPostsData = posts.map((post) => ({
      postId: post.postId,
      date: post.date,
      title: post.title,
      views: post.views || 0, // Garante que views seja 0 se não existir
    }));

    console.log("Posts data from MongoDB:", allPostsData);

    return {
      props: {
        allPostsData,
        error: null,
      },
    };
  } catch (error) {
    console.error("Error fetching posts from MongoDB:", error);
    return {
      props: {
        allPostsData: [],
        error: "Failed to fetch posts data",
      },
    };
  }
};
