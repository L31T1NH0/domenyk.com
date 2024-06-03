import { Layout } from "@components/layout";
import { Date } from "@components/date";
import { getAllPostsId, getPostData } from "@lib/posts";
import type { PostContent, PostPath } from "@lib/posts";

type PostProps = {
  postData: PostContent;
};

export default function Post({
  postData: { date, title, htmlContent },
}: PostProps): JSX.Element {
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

export async function getStaticPaths() {
  const paths = await getAllPostsId();

  return {
    paths,
    fallback: false,
  };
}

export async function getStaticProps({ params: { id } }: PostPath) {
  const postData = await getPostData(id);

  return {
    props: {
      postData,
    },
  };
}
