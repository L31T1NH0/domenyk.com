import { Header } from './header';
import { BackHome } from './back-home';
import ThemeSwitcher from './ThemeSwitcher';

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
    <div className="max-w-xl flex flex-col mx-auto px-2 py-2">
      <div>
        <ThemeSwitcher />
      </div>
      <Header home={home} />
      <main className={`${home} flex flex-col flex-1`}>{children}</main>
      {!home && <BackHome />}
    </div>
  );
}
