import { GetServerSideProps } from "next";
import Link from "next/link";
import { Layout } from "@components/layout";
import { Date } from "@components/date";
import axios from "axios";
import { JSX } from "react";
import { useRouter } from "next/router";
import clientPromise from "../lib/mongo";

// Define o componente Views
const Views = ({ views }: { views: number }) => (
  <span className="text-zinc-400 p-0.5">{views} views</span>
);

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

  const handlePostClick = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    console.log("Sending request to /api/posts/view with id:", id);
    try {
      const response = await axios.post("/api/posts/view", { id });
      console.log("Response from backend:", response.data);
      if (response.data.message === "View not updated (already viewed)") {
        console.log("User already viewed this post, no update made.");
      }
      // Navega para o post sem recarregar toda a página
      router.push(`/posts/${id}`);
    } catch (error: any) {
      console.error("Failed to update post view count. Error details:", {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
      });
      // Em caso de erro, ainda navega para o post (opcional, dependendo do caso de uso)
      router.push(`/posts/${id}`);
    }
  };

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
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
                <Date dateString={date} /> <Views views={views} />
              </small>
            </li>
          ))}
        </ul>
      </section>
    </Layout>
  );
}

export const getServerSideProps: GetServerSideProps = async () => {
  try {
    // Busca os dados da API externa
    const response = await axios.get(
      `${process.env.NEXT_PUBLIC_API_URL}/api/posts`
    );
    console.log("Posts data received from API:", response.data);
    const apiPosts: PostData[] = response.data;

    // Conecta ao MongoDB usando o clientPromise
    const client = await clientPromise;
    const database = client.db("blog");
    const postsCollection = database.collection("posts");

    // Pega todos os postIds da API
    const postIds = apiPosts.map((post) => post.id);

    // Busca as views correspondentes no MongoDB
    const mongoPosts = await postsCollection
      .find({ postId: { $in: postIds } })
      .toArray();
    console.log("Posts found in MongoDB:", mongoPosts);

    // Mescla os dados da API com as views do MongoDB
    const allPostsData = apiPosts.map((apiPost) => {
      const mongoPost = mongoPosts.find((p) => p.postId === apiPost.id);
      const views = mongoPost ? mongoPost.views : 0; // 0 se não existir
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
