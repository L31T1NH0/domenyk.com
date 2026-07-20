export const SITE_TIME_ZONE = "America/Fortaleza"

type DateInput = Date | string | number

type SiteDateParts = {
  year: number
  month: number
  day: number
}

const dateKeyFormatter = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: SITE_TIME_ZONE,
})

function toDate(value: DateInput): Date {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) throw new RangeError("Data inválida")
  return date
}

function dateParts(value: DateInput): SiteDateParts {
  const parts = dateKeyFormatter.formatToParts(toDate(value))
  const part = (type: Intl.DateTimeFormatPartTypes) => {
    const value = parts.find((item) => item.type === type)?.value
    if (!value) throw new RangeError("Não foi possível interpretar a data")
    return Number(value)
  }

  return { year: part("year"), month: part("month"), day: part("day") }
}

function dateKeyFromParts({ year, month, day }: SiteDateParts): string {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

export function siteDateKey(value: DateInput = new Date()): string {
  return dateKeyFromParts(dateParts(value))
}

export function shiftSiteDateKey(dateKey: string, days: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey)
  if (!match) throw new RangeError("Data de calendário inválida")

  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
  if (
    date.getUTCFullYear() !== Number(match[1])
    || date.getUTCMonth() !== Number(match[2]) - 1
    || date.getUTCDate() !== Number(match[3])
  ) {
    throw new RangeError("Data de calendário inválida")
  }
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function timeZoneOffsetMs(value: Date): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
    timeZone: SITE_TIME_ZONE,
  })
  const parts = formatter.formatToParts(value)
  const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((item) => item.type === type)?.value)
  const representedAsUtc = Date.UTC(
    part("year"),
    part("month") - 1,
    part("day"),
    part("hour"),
    part("minute"),
    part("second")
  )
  return representedAsUtc - Math.floor(value.getTime() / 1000) * 1000
}

export function siteDateKeyToInstant(dateKey: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey)
  if (!match) throw new RangeError("Data de calendário inválida")
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const wallClockUtc = Date.UTC(year, month - 1, day)
  const calendarDate = new Date(wallClockUtc)
  if (
    calendarDate.getUTCFullYear() !== year
    || calendarDate.getUTCMonth() !== month - 1
    || calendarDate.getUTCDate() !== day
  ) {
    throw new RangeError("Data de calendário inválida")
  }

  let instant = new Date(wallClockUtc)
  for (let attempt = 0; attempt < 2; attempt += 1) {
    instant = new Date(wallClockUtc - timeZoneOffsetMs(instant))
  }
  return instant
}

export function startOfSiteDay(value: DateInput = new Date(), dayOffset = 0): Date {
  return siteDateKeyToInstant(shiftSiteDateKey(siteDateKey(value), dayOffset))
}

export function siteCalendarYear(value: DateInput = new Date()): number {
  return dateParts(value).year
}

export function formatSiteDate(
  value: DateInput,
  options: Intl.DateTimeFormatOptions,
  locale = "pt-BR"
): string {
  return new Intl.DateTimeFormat(locale, { ...options, timeZone: SITE_TIME_ZONE }).format(toDate(value))
}
