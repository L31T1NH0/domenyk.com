import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { Layout } from "@components/layout";
import { Date } from "@components/date";
import axios from "axios";

type PostContent = {
  id: string;
  date: string;
  title: string;
  htmlContent: string;
};

export default function Post(): JSX.Element {
  const router = useRouter();
  const { id } = router.query;

  const [postData, setPostData] = useState<PostContent | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      fetchPostData(id as string);
    }
  }, [id]);

  async function fetchPostData(postId: string) {
    try {
      const response = await axios.get(`/api/posts/${postId}`);
      setPostData(response.data);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An unknown error occurred");
      }
    }
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  if (!postData) {
    return <div>No data available</div>;
  }

  const { date, title, htmlContent } = postData;
  const path = `/posts/${title}`;

  return (
    <Layout title={title} description={title} url={path}>
      <article className="flex flex-col gap-4">
        <h1 className="lg:text-3xl max-sm:text-xl font-bold">{title}</h1>
        <Date dateString={date} />
        <div
          className="flex flex-col gap-4 lg:text-lg sm:text-sm max-sm:text-xs"
          dangerouslySetInnerHTML={{ __html: htmlContent }}
        />
      </article>
    </Layout>
  );
}
