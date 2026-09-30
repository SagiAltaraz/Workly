// Dates travel as 'YYYY-MM-DD' strings and are computed in UTC, so the server's own
// timezone never shifts a day.

export const hebrewWeekdays = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'] as const

const millisPerDay = 86_400_000

export function isValidCalendarDate(year: number, month: number, day: number): boolean {
  const date = new Date(Date.UTC(year, month - 1, day))
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  )
}

export function toIso(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function fromIso(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day))
}

function dateToIso(date: Date): string {
  return toIso(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate())
}

export function addDays(iso: string, days: number): string {
  return dateToIso(new Date(fromIso(iso).getTime() + days * millisPerDay))
}

// 0 = Sunday … 6 = Saturday, matching hebrewWeekdays.
export function weekdayOf(iso: string): number {
  return fromIso(iso).getUTCDay()
}

export function todayInIsrael(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

export function formatTime(hours: number, minutes: number): string {
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

// The date and the minutes since midnight in Israel at a given moment, from the real clock and not
// from the server's own timezone.
export function israelClock(now: Date = new Date()): { date: string; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now)
  const pick = (type: string) => Number(parts.find((part) => part.type === type)?.value)
  return {
    date: toIso(pick('year'), pick('month'), pick('day')),
    minutes: pick('hour') * 60 + pick('minute'),
  }
}
