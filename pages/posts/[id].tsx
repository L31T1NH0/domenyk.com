import React, { useEffect } from "react";
import { GetServerSideProps } from "next";
import { useRouter } from "next/router";
import { Layout } from "@components/layout";
import { Date } from "@components/date"; // Integração com o componente Date
import axios from "axios";
import { JSX } from "react";
import ShareButton from "../../components/ShareButton";
import { Views } from "@components/views";
import { useViews } from "../../lib/viewsManager"; // Importe o novo hook
import clientPromise from "../../lib/mongo"; // Importa a conexão com o MongoDB
import { NextSeo, ArticleJsonLd } from "next-seo"; // Importe NextSeo e ArticleJsonLd
import Comment from "@components/Comment";
import { BackHome } from "../../components/back-home";

type PostContent = {
  postId: string; // Substitua id por postId para consistência com o MongoDB
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
  const { id } = router.query; // Obtém o postId da URL

  // Usa o hook useViews para gerenciar as views dinamicamente, passando as views iniciais
  const { views, updateViews } = useViews(id, postData?.views || 0);

  useEffect(() => {
    if (id && postData?.postId) {
      updateViews().catch((error) =>
        console.error("Failed to update views on load:", error)
      );
    }
  }, [id, postData?.postId, updateViews]);

  if (error) {
    return <div>Error: {error}</div>;
  }

  if (!postData) {
    return <div>No data available</div>;
  }

  const { date, title, htmlContent } = postData;
  const path = `/posts/${id}`; // Corrigido para usar postId (id), não Post
  const readingTime = calculateReadingTime(htmlContent);

  const safeHtmlContent = typeof htmlContent === "string" ? htmlContent : "";

  return (
    <>
      <NextSeo
        title={`${title} - Blog`}
        description={title}
        openGraph={{
          title: `${title} `,
          description: title,
          url: `https://blog-roan-nu.vercel.app/posts/${id}`,
        }}
        twitter={{
          handle: "@l31t1",
        }}
      />
      <ArticleJsonLd
        type="BlogPosting"
        url={`https://blog-roan-nu.vercel.app/posts/${id}`}
        title={title}
        images={[
          "https://blog-roan-nu.vercel.app/_next/image?url=%2Fimages%2Fprofile.jpg&w=256&q=75",
        ]}
        datePublished={date}
        dateModified={date} // Ajuste para a data real de modificação, se disponível
        authorName="Domenyk" // Substitua pelo seu nome ou o da API
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
                <Views views={views} />
              </span>
            </div>
          </div>
          <div>
            <ShareButton id={id as string} />
          </div>
          <div
            className="flex flex-col gap-4 lg:text-lg sm:text-sm max-sm:text-xs"
            dangerouslySetInnerHTML={{ __html: safeHtmlContent }}
          />
        </article>
        <div>
          <BackHome />
        </div>
        <Comment postId={postData.postId} />
      </Layout>
    </>
  );
};

export default Post;

export const getServerSideProps: GetServerSideProps = async (context) => {
  const { id } = context.params ?? {};
  const { req, res } = context;

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
    let views = mongoPost ? mongoPost.views || 0 : 0;

    // Verifica o cookie no servidor para evitar incrementos duplicados
    const cookieName = `viewed_${id}`;
    const viewedCookie = req.headers.cookie
      ?.split(";")
      .find((c) => c.trim().startsWith(`${cookieName}=true`));

    if (!viewedCookie) {
      await postsCollection.updateOne({ postId: id }, { $inc: { views: 1 } });
      views += 1;
      res.setHeader(
        "Set-Cookie",
        `viewed_${id}=true; Max-Age=86400; Path=/; HttpOnly; SameSite=Lax`
      );
    }

    return {
      props: {
        postData: {
          postId: response.data.postId,
          date: response.data.date,
          title: response.data.title,
          htmlContent: response.data.htmlContent,
          views, // Retorna as views atualizadas
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
  return `${minutes} min`;
}
