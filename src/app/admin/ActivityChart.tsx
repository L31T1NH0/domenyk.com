import type { ActivityDashboard } from "@/lib/db/activity"
import { formatSiteDate, siteDateKeyToInstant } from "@/lib/datetime"

export function ActivityChart({ days }: { days: ActivityDashboard["days"] }) {
  const max = Math.max(1, ...days.map((day) => day.views + day.comments))
  return (
    <div className="admin-chart" role="img" aria-label="Atividade dos últimos 14 dias">
      {days.map((day, index) => (
        <div className="admin-chart-column" key={day.date} title={`${day.date}: ${day.views} views, ${day.comments} comentários`}>
          <div className="admin-chart-bars">
            <span className="admin-chart-bar admin-chart-bar-view" style={{ height: `${Math.max(day.views ? 6 : 0, day.views / max * 100)}%` }} />
            <span className="admin-chart-bar admin-chart-bar-comment" style={{ height: `${Math.max(day.comments ? 6 : 0, day.comments / max * 100)}%` }} />
          </div>
          {(index === 0 || index === days.length - 1 || index === Math.floor(days.length / 2)) && <time dateTime={day.date}>{formatSiteDate(siteDateKeyToInstant(day.date), { day: "2-digit", month: "short" })}</time>}
        </div>
      ))}
    </div>
  )
}
