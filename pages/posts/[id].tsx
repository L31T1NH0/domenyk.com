import React from 'react';
import { GetServerSideProps } from "next";
import { useRouter } from "next/router";
import { Layout } from "@components/layout";
import { Date } from "@components/date";
import axios from "axios";
import { JSX } from "react";
import ShareButton from '../../components/ShareButton';

type PostContent = {
  id: string;
  date: string;
  title: string;
  htmlContent: string;
};

type PostProps = {
  postData: PostContent | null;
  error: string | null;
};

const Post = ({ postData, error }: PostProps): JSX.Element => {
  const router = useRouter();

  if (error) {
    return <div>Error: {error}</div>;
  }

  if (!postData) {
    return <div>No data available</div>;
  }

  const { id, date, title, htmlContent } = postData;
  const path = `/posts/${title}`;
  const readingTime = calculateReadingTime(htmlContent);

  return (
    <Layout title={title} description={title} url={path}>
      <article className="flex flex-col gap-4 py-4">
        <h1 className="lg:text-3xl max-sm:text-xl font-bold">{title}</h1>
        <div className="flex items-center gap-2">
          <div className="flex gap-2">
            <Date dateString={date} />
            <ShareButton id={id} />
            <div>
              <span className="text-sm text-zinc-500">• {readingTime}</span>
            </div>
          </div>
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

  if (!id) {
    return {
      notFound: true,
    };
  }

  try {
    const response = await axios.get(
      `${process.env.NEXT_PUBLIC_API_URL}/api/posts/${id}`
    );
    return {
      props: {
        postData: response.data,
        error: null,
      },
    };
  } catch (error) {
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
  const text = htmlContent.replace(/<[^>]+>/g, '');
  const words = text.split(/\s+/).length;
  const minutes = Math.ceil(words / wordsPerMinute);
  return `${minutes} min de leitura`;
}

