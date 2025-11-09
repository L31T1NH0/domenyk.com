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
    <div className="max-w-xl flex flex-col mx-auto px-4 mb-4" data-layout-container="true">
      <div className="flex justify-between items-center py-1">
        <div className="flex items-center h-8">
          <ThemeSwitcher />
        </div>
        <div className="flex items-center h-8 z-40">
          <SettingsMenu />
        </div>
      </div>
      <main className={`${home ? "home" : ""} relative flex flex-col flex-1`}>
        {children}
      </main>
    </div>
  );
}
