"use client";

import dynamic from "next/dynamic";
import ThemeSwitcher from "./ThemeSwitcher";
import ScrollProgressEffect from "./ScrollProgressEffect";

const SettingsMenu = dynamic(() => import("./SettingsMenu"), {
  ssr: false,
  loading: () => <span aria-hidden className="block h-8 w-8" />,
});

type LayoutProps = {
  title?: string;
  description?: string;
  url?: string;
  home?: boolean;
  children: React.ReactNode;
  hideHeaderControls?: boolean;
};

export function Layout({ home = false, children, hideHeaderControls = false }: LayoutProps) {
  const currentYear = new Date().getFullYear();

  return (
    <div
      data-scroll-progress-root
      className="max-w-xl flex flex-col mx-auto px-4 mb-4"
    >
      <ScrollProgressEffect />
      <header className="flex justify-between items-center py-1">
        <div aria-hidden="true" data-scroll-progress-bar />
        {hideHeaderControls ? (
          <span aria-hidden className="h-8 w-8" />
        ) : (
          <ThemeSwitcher />
        )}
        {hideHeaderControls ? (
          <span aria-hidden className="h-8 w-8" />
        ) : (
          <SettingsMenu />
        )}
      </header>
      <main className={`${home ? "home" : ""} flex flex-col flex-1`}>
        {children}
      </main>
      <footer
        className="mt-10 mb-4 text-center text-sm leading-relaxed text-zinc-400"
        style={{ fontFamily: "Calibri, Candara, Segoe, 'Segoe UI', Optima, Arial, sans-serif" }}
      >
        <p>© {currentYear} domenyk.com</p>
        <p className="mt-1 break-all">bc1qfv788krszr8xz3uxvvzy33pp8jph0hw53557d4</p>
      </footer>
    </div>
  );
}
