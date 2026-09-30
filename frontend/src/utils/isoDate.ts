// Display-only date helpers. The server computes every date that matters; the UI only
// formats them and lays them out on a calendar.

export const weekdayNames = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'] as const
export const weekdayInitials = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'] as const
export const monthNames = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
] as const

const millisPerDay = 86_400_000

export interface DateParts {
  year: number
  month: number
  day: number
}

export function partsOf(iso: string): DateParts {
  const [year, month, day] = iso.split('-').map(Number)
  return { year, month, day }
}

export function toIso({ year, month, day }: DateParts): string {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function toUtc(iso: string): Date {
  const { year, month, day } = partsOf(iso)
  return new Date(Date.UTC(year, month - 1, day))
}

export function addDays(iso: string, days: number): string {
  const date = new Date(toUtc(iso).getTime() + days * millisPerDay)
  return toIso({ year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() })
}

export function diffDays(fromIso: string, toIsoDate: string): number {
  return Math.round((toUtc(toIsoDate).getTime() - toUtc(fromIso).getTime()) / millisPerDay)
}

export function weekdayIndex(iso: string): number {
  return toUtc(iso).getUTCDay()
}

export function formatShort(iso: string): string {
  const { year, month, day } = partsOf(iso)
  return `${day}.${month}.${year}`
}

export function formatDayMonth(iso: string): string {
  const { month, day } = partsOf(iso)
  return `${day}.${month}`
}

export function todayInIsrael(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

// "היום", "מחר", "אתמול", otherwise the weekday and date.
export function relativeLabel(iso: string, referenceDate: string): string {
  const offset = diffDays(referenceDate, iso)
  if (offset === 0) return 'היום'
  if (offset === 1) return 'מחר'
  if (offset === 2) return 'מחרתיים'
  if (offset === -1) return 'אתמול'
  return `${weekdayNames[weekdayIndex(iso)]} ${formatDayMonth(iso)}`
}

export function weekdayAndDate(iso: string): string {
  return `יום ${weekdayNames[weekdayIndex(iso)]}, ${formatShort(iso)}`
}
