import ThemeSwitcher from "./ThemeSwitcher";
import SettingsMenu from "./SettingsMenu";

type LayoutProps = {
  title?: string;
  description?: string;
  url?: string;
  home?: boolean;
  children: React.ReactNode;
};

export function Layout({ home = false, children }: LayoutProps) {
  return (
    <div className="relative" data-layout-container="true">
      {/* Botões flutuantes: seguem o usuário ao rolar */}
      <div className="fixed top-3 left-3 z-40 pointer-events-none">
        <div className="pointer-events-auto">
          <SettingsMenu />
        </div>
      </div>
      <div className="fixed top-3 right-3 z-40 pointer-events-none">
        <div className="pointer-events-auto">
          <ThemeSwitcher />
        </div>
      </div>

      {/* Conteúdo principal centralizado */}
      <div className="max-w-xl flex flex-col mx-auto px-4 mb-4">
        <main className={`${home ? "home" : ""} relative flex flex-col flex-1 pt-10`}>
          {children}
        </main>
      </div>
    </div>
  );
}

