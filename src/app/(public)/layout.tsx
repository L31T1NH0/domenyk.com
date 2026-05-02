import { ThemeSwitcher } from "@/components/ThemeSwitcher"
import { ClerkButton } from "@/components/ClerkButton"
import { ScrollProgressEffect } from "@/components/ScrollProgressEffect"

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  const currentYear = new Date().getFullYear()

  return (
    <div data-scroll-progress-root className="w-full max-w-[36rem] flex flex-col mx-auto px-4 mb-4">
      <div aria-hidden data-scroll-progress-bar />
      <ScrollProgressEffect />
      <header className="flex justify-between items-center py-1">
        <ThemeSwitcher />
        <ClerkButton />
      </header>
      <main className="flex flex-col flex-1">
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
  )
}
