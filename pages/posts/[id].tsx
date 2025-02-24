import React from "react";
import { GetServerSideProps } from "next";
import { useRouter } from "next/router";
import { Layout } from "@components/layout";
import { Date } from "@components/date";
import axios from "axios";
import { JSX } from "react";
import ShareButton from "../../components/ShareButton";
import { Views } from "@components/views";
import { useViews } from "../../lib/viewsManager"; // Importe o novo hook
import clientPromise from "../../lib/mongo"; // Importa a conexão com o MongoDB

type PostContent = {
  id: string;
  date: string;
  title: string;
  htmlContent: string;
  views: number; // Visualizações do post (mantido para SSR)
};

type PostProps = {
  postData: PostContent | null;
  error: string | null;
};

const Post = ({ postData, error }: PostProps): JSX.Element => {
  const router = useRouter();
  const { id } = router.query; // Obtém o id da URL

  // Usa o hook useViews para gerenciar as views dinamicamente, passando as views iniciais
  const { views } = useViews(id, postData?.views || 0);

  if (error) {
    return <div>Error: {error}</div>;
  }

  if (!postData) {
    return <div>No data available</div>;
  }

  const { date, title, htmlContent } = postData;
  const path = `/posts/${title}`;
  const readingTime = calculateReadingTime(htmlContent);

  return (
    <Layout title={title} description={title} url={path}>
      <article className="flex flex-col gap-2 py-4">
        <h1 className="lg:text-3xl max-sm:text-xl font-bold">{title}</h1>
        <div className="flex gap-2">
          <Date dateString={date} />
          <div>
            <span className="text-sm text-zinc-500">• {readingTime}</span>
            <span className="text-sm text-zinc-500 p-1">
              <Views views={views} />
            </span>
          </div>
        </div>
        <div>
          <ShareButton id={id as string} />
        </div>
        <div
          className="flex flex-col gap-4 lg:text-lg sm:text-sm max-sm:text-xs"
          dangerouslySetInnerHTML={{ __html: htmlContent }}
        />
      </article>
    </Layout>
  );
};

export default Post;

export const getServerSideProps: GetServerSideProps = async (context) => {
  const { id } = context.params ?? {};

  if (!id || typeof id !== "string") {
    return {
      notFound: true,
    };
  }

  try {
    const response = await axios.get(
      `${process.env.NEXT_PUBLIC_API_URL}/api/posts/${id}`
    );
    console.log("Post data from API:", response.data);

    const client = await clientPromise;
    const database = client.db("blog");
    const postsCollection = database.collection("posts");

    const mongoPost = await postsCollection.findOne({ postId: id });
    const views = mongoPost ? mongoPost.views : 0;

    return {
      props: {
        postData: {
          ...response.data,
          views, // Adiciona as views ao postData para SSR, garantindo consistência
        },
        error: null,
      },
    };
  } catch (error) {
    console.error("Error fetching post data or views:", error);
    return {
      props: {
        postData: null,
        error: "Failed to fetch post data",
      },
    };
  }
};

function calculateReadingTime(htmlContent: string): string {
  const wordsPerMinute = 200;
  const text = htmlContent.replace(/<[^>]+>/g, "");
  const words = text.split(/\s+/).length;
  const minutes = Math.ceil(words / wordsPerMinute);
  return `${minutes} min de leitura`;
}
