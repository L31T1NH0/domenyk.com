import { GetServerSideProps } from "next";
import Link from "next/link";
import { Layout } from "@components/layout";
import { Date } from "@components/date";
import axios from "axios";

type PostData = {
  id: string;
  date: string;
  title: string;
};

type HomeProps = {
  allPostsData: PostData[];
  error: string | null;
};

export default function Home({ allPostsData, error }: HomeProps): JSX.Element {
  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
    <Layout home>
      <section className="text-xl flex flex-col gap-4 py-2 text-primary">
        <h2>
          Olá, sou <span className="font-bold">Leite</span>. Um "ávido filósofo"
          e atento observador da política brasileira.
        </h2>
        <p>
          Veja meus <a href="https://next-domenyk.vercel.app">Links</a>.
        </p>
      </section>
      <section className="flex flex-col gap-4">
        <h2 className="font-bold text-2xl">Blog</h2>
        <ul className="text-xl ml-0 flex flex-col gap-4">
          {allPostsData.map(({ id, date, title }) => (
            <li className="flex flex-col gap-2" key={id}>
              <Link href={`/posts/${id}`}>{title}</Link>
              <small>
                <Date dateString={date} />
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
    const response = await axios.get(
      `${process.env.NEXT_PUBLIC_API_URL}/api/posts`
    );
    return {
      props: {
        allPostsData: response.data,
        error: null,
      },
    };
  } catch (error) {
    return {
      props: {
        allPostsData: [],
        error: "Failed to fetch posts data",
      },
    };
  }
};
