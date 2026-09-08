import { PersonalTimeline } from "./PersonalTimeline"

export function TimelinePersonalRail({
  isAdmin,
  hasDesktopThreads,
}: {
  isAdmin: boolean
  hasDesktopThreads: boolean
}) {
  return (
    <aside
      aria-label="Publicações de Domenyk"
      className="home-timeline-personal-rail absolute inset-y-0 right-[calc(100%+26px)] hidden min-w-0 min-[84rem]:block"
      style={{
        width: hasDesktopThreads
          ? "max(0px, calc(32.5vw - 11.2125rem - 26px))"
          : "max(0px, calc(50vw - 50% - 42px))",
      }}
    >
      <div className="timeline-thread-scroll sticky top-4 max-h-[calc(100dvh-2rem)] w-full min-w-0 overflow-y-auto overscroll-y-contain pr-1">
        <div className="w-full min-w-0"><PersonalTimeline isAdmin={isAdmin} compact /></div>
      </div>
    </aside>
  )
}
