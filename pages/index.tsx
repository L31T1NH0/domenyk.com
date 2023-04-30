import Link from 'next/link';
import { Layout } from '@components/layout';
import { Date } from '@components/date';
import { getSortedPostsData, PostsData } from '@lib/posts';

type HomeProps = {
  allPostsData: PostsData;
};

export default function Home({ allPostsData }: HomeProps): JSX.Element {
  return (
    <Layout home>
      <section className='text-xl flex flex-col gap-4 text-primary'>
        <h2>
          Olá, sou <span className='font-bold'>Leite</span>. Um "ávido filósofo"
          e atento observador da política brasileira.
        </h2>
        <p>
          Veja meus <a href='https://next-domenyk.vercel.app'>Links</a>.
        </p>
      </section>
      <section className='flex flex-col gap-6'>
        <h2 className='font-bold text-2xl'>Blog</h2>
        <ul className='text-xl ml-0 flex flex-col gap-4'>
          {allPostsData.map(({ id, date, title }) => (
            <li className='flex flex-col gap-2' key={id}>
              <Link href={`/posts/${id}`}>
                <a>{title}</a>
              </Link>
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

type StaticReturn = {
  props: {
    allPostsData: PostsData;
  };
};

export async function getStaticProps(): Promise<StaticReturn> {
  const allPostsData = getSortedPostsData();

  return {
    props: {
      allPostsData
    }
  };
}
