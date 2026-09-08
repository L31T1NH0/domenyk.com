import { PersonalTimeline } from "./PersonalTimeline"

export function TimelinePersonalRail({ isAdmin }: { isAdmin: boolean }) {
  return (
    <aside aria-label="Publicações de Domenyk" className="home-timeline-personal-rail min-w-0">
      <div className="personal-timeline-rail-scroll timeline-thread-scroll">
        <div className="personal-timeline-rail-feed"><PersonalTimeline isAdmin={isAdmin} compact /></div>
      </div>
    </aside>
  )
}
