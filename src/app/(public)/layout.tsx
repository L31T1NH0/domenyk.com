import { ThemeSwitcher } from "@/components/ThemeSwitcher"
import { ClerkButton } from "@/components/ClerkButton"
import { ScrollProgressEffect } from "@/components/ScrollProgressEffect"

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  const currentYear = new Date().getFullYear()

  return (
    <div data-public-shell data-scroll-progress-root className="mx-auto mb-4 flex w-full max-w-[36rem] flex-col overflow-x-visible px-4 sm:w-[min(100%,34.5rem)] sm:max-w-[100vw]">
      <a
        href="#conteudo-principal"
        className="fixed left-4 top-4 z-50 -translate-y-20 rounded-md bg-neutral-950 px-3 py-2 text-sm font-medium text-white transition-transform focus:translate-y-0 focus:outline-none focus:ring-2 focus:ring-neutral-500 focus:ring-offset-2 motion-reduce:transition-none dark:bg-white dark:text-neutral-950 dark:focus:ring-neutral-300 dark:focus:ring-offset-black"
      >
        Pular para o conteúdo
      </a>
      <div aria-hidden data-scroll-progress-bar />
      <ScrollProgressEffect />
      <header className="flex items-center justify-between py-1">
        <ThemeSwitcher />
        <ClerkButton />
      </header>
      <main id="conteudo-principal" tabIndex={-1} className="flex min-w-0 flex-1 flex-col">
        {children}
      </main>
      <footer
        className="mb-4 mt-12 text-center text-xs leading-relaxed text-zinc-600 dark:text-zinc-400"
      >
        <p>© {currentYear} domenyk.com</p>
        <p className="mt-1 break-all">bc1qfv788krszr8xz3uxvvzy33pp8jph0hw53557d4</p>
      </footer>
    </div>
  )
}
