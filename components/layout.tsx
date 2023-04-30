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
    <div className='max-w-xl px-4 py-12 mx-auto flex flex-col gap-8 min-h-screen'>
      <Header home={home} />
      <main className={`${home ? 'gap-8' : 'gap-4'} flex flex-col flex-1`}>
        {children}
      </main>
      {!home && <BackHome />}
    </div>
  );
}
