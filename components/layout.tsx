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
};

export function Layout({ home = false, children }: LayoutProps) {
  return (
    <div
      data-scroll-progress-root
      className="max-w-xl flex flex-col mx-auto px-4 mb-4"
    >
      <ScrollProgressEffect />
      <header className="flex justify-between items-center py-1">
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
