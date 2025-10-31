import ThemeSwitcher from "./ThemeSwitcher";
import SettingsMenu from "./SettingsMenu";
import { cn } from "@lib/cn";

type LayoutProps = {
  title?: string;
  description?: string;
  url?: string;
  home?: boolean;
  children: React.ReactNode;
};

export const layoutClasses = {
  container: "layout-container",
  grid: "layout-grid",
  section: "layout-section",
  sectionTight: "layout-section-tight",
  stack: "layout-stack",
  columns: {
    full: "col-span-full",
    main: "col-span-full lg:col-span-8 lg:col-start-3",
    wide: "col-span-full lg:col-span-10 lg:col-start-2",
    sidebar: "col-span-full lg:col-span-4",
  },
};

export function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)]">
      <div className={layoutClasses.container}>
        <div className={cn(layoutClasses.grid, layoutClasses.sectionTight)}>
          <div className="col-span-full flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <SettingsMenu />
            </div>
            <div className="flex items-center gap-2">
              <ThemeSwitcher />
            </div>
          </div>
        </div>

        <main className={cn("pb-24", layoutClasses.stack)}>{children}</main>
      </div>
    </div>
  );
}
