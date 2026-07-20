const NOTIFICATION_TIME_ZONE = "America/Fortaleza"

const notificationDayFormatter = new Intl.DateTimeFormat("en-US", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: NOTIFICATION_TIME_ZONE,
})

export function notificationDay(date: Date) {
  const parts = Object.fromEntries(
    notificationDayFormatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  )

  return `${parts.year}-${parts.month}-${parts.day}`
}

export function dailyNotificationAggregateKey(aggregateKey: string, date: Date) {
  return `${aggregateKey}:day:${notificationDay(date)}`
}
