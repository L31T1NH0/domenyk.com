
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
    <div className="min-h-screen bg-neutral-950 text-neutral-100 antialiased">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-10 lg:px-12 lg:py-14">
        <div className="flex flex-col gap-6 border-b border-neutral-800 pb-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex flex-col gap-2 text-neutral-400">
            <span className="text-xs font-medium uppercase tracking-[0.4em] text-neutral-500">
              Domenyk.com
            </span>
            <span className="text-sm leading-relaxed">
              Notas públicas, observações e relatórios pessoais publicados sem adornos.
            </span>
          </div>
          <div className="flex items-center gap-3 text-neutral-400">
            <SettingsMenu />
            <ThemeSwitcher />
          </div>
        </div>
        <main
          className={`flex-1 pt-10 ${
            home
              ? "lg:grid lg:grid-cols-[minmax(220px,320px)_1fr] lg:items-start lg:gap-16"
              : "flex flex-col gap-12"
          }`}
        >
          {children}
        </main>
      </div>
    </div>
  );
}