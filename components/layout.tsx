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
    <div className="max-w-xl flex flex-col mx-auto px-4 mb-4">
      <header
        data-scroll-progress-root
        className="flex justify-between items-center py-1"
      >
        <div aria-hidden="true" data-scroll-progress-bar />
        <ThemeSwitcher /> {/* Botão de brilho à direita */}
        <SettingsMenu /> {/* Botão de três pontos à esquerda */}
      </header>
      <main className={`${home ? "home" : ""} flex flex-col flex-1`}>
        {children}
      </main>
    </div>
  );
}
