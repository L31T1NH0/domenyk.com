import { Header } from './header';
import { BackHome } from './back-home';

type LayoutProps = {
  title?: string;
  description?: string;
  url?: string;
  home?: boolean;
  children: React.ReactNode;
};

export function Layout({
  home,
  children
}: LayoutProps) {

  return (
    <div className='max-w-xl flex flex-col mx-auto px-4 py-12'>
      <Header home={home} />
      <main className={`${home} flex flex-col flex-1`}>
        {children}
      </main>
      {!home && <BackHome />}
    </div>
  );
}
