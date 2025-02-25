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
import { NextSeo } from "next-seo"; // Importe NextSeo

type PostData = {
  id: string;
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
    acc[post.id] = useViews(post.id, post.views);
    return acc;
  }, {} as Record<string, ReturnType<typeof useViews>>);

  // Use useEffect para garantir que o router só seja usado no cliente
  useEffect(() => {
    console.log("Router mounted on client:", router);
  }, [router]);

  const handlePostClick = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    console.log("Sending request to /api/posts/view with id:", id);
    try {
      const { updateViews } = viewsManagers[id]; // Acesse updateViews para o postId específico
      const response: AxiosResponse<ViewResponse> = await updateViews(); // Chama updateViews manualmente ao clicar
      console.log("Response from backend (via handlePostClick):", {
        message: "View updated or checked",
        headers: response.headers["set-cookie"] || "No cookie set",
        data: response.data,
      });
      router.push(`/posts/${id}`);
    } catch (error: any) {
      console.error("Failed to update post view count. Error details:", {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
        headers: error.response?.headers,
      });
      router.push(`/posts/${id}`);
    }
  };

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
    <>
      <NextSeo
        title="Dou minhas opiniões aqui - Blog"
        description="Minhas opiniões."
        openGraph={{
          title: "Dou minhas opiniões aqui - Blog",
          description: "Minhas opiniões.",
          url: "https://blog-roan-nu.vercel.app/",
        }}
        twitter={{
          handle: "@l31t1",
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
            {allPostsData.map(({ id, date, title, views }) => (
              <li className="flex flex-col gap-2" key={id}>
                <Link href={`/posts/${id}`} legacyBehavior>
                  <a onClick={(e) => handlePostClick(id, e)}>{title}</a>
                </Link>
                <small className="text-zinc-400">
                  <Date dateString={date} />{" "}
                  <Views views={useViews(id, views).views} />{" "}
                  {/* Passa as views iniciais */}
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
    const response = await axios.get(
      `${process.env.NEXT_PUBLIC_API_URL}/api/posts`
    );
    console.log("Server-side data:", response.data);
    const apiPosts: PostData[] = response.data;

    const client = await clientPromise;
    const database = client.db("blog");
    const postsCollection = database.collection("posts");

    const postIds = apiPosts.map((post) => post.id);
    const mongoPosts = await postsCollection
      .find({ postId: { $in: postIds } })
      .toArray();
    console.log("Posts found in MongoDB:", mongoPosts);

    const allPostsData = apiPosts.map((apiPost) => {
      const mongoPost = mongoPosts.find((p) => p.postId === apiPost.id);
      const views = mongoPost ? mongoPost.views : 0;
      console.log(
        `Merging post ${apiPost.id}: views = ${views}, title = ${apiPost.title}, date = ${apiPost.date}`
      );
      return {
        ...apiPost,
        views,
      };
    });

    console.log("Merged posts data:", allPostsData);

    return {
      props: {
        allPostsData,
        error: null,
      },
    };
  } catch (error) {
    console.error("Error fetching posts or views:", error);
    return {
      props: {
        allPostsData: [],
        error: "Failed to fetch posts data or views",
      },
    };
  }
};
