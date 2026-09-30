import { addDays, hebrewWeekdays, isValidCalendarDate, toIso, weekdayOf } from './dateMath'
import { correctDateWords, type Correction } from './hebrewLexicon'

export interface ParsedDate {
  date: string
  // 'explicit' is a full written date; a missing year, a relative word or a weekday
  // name means the code had to derive it from the reference date.
  kind: 'explicit' | 'inferred'
  // Words read despite a slip of a letter ("מחרר" as "מחר"); the date then always counts as inferred.
  corrections: Correction[]
}

const weekdayRegex = new RegExp(
  `יום\\s+(${hebrewWeekdays.join('|')})(?!\\p{Script=Hebrew})`,
  'u',
)

// Index into hebrewWeekdays (0 = Sunday), from wording like "ביום חמישי".
export function findWeekday(text: string): number | null {
  const match = weekdayRegex.exec(correctDateWords(text).text)
  return match ? hebrewWeekdays.indexOf(match[1] as (typeof hebrewWeekdays)[number]) : null
}

function expandYear(year: number): number {
  return year < 100 ? 2000 + year : year
}

export function parseDate(original: string, referenceDate: string): ParsedDate | null {
  const { text, corrections } = correctDateWords(original)
  const found = readDate(text, referenceDate)
  if (!found) return null
  return corrections.length > 0 ? { ...found, kind: 'inferred', corrections } : { ...found, corrections }
}

function readDate(text: string, referenceDate: string): Omit<ParsedDate, 'corrections'> | null {
  const full = /(?<![\d.])(\d{1,2})[./](\d{1,2})[./](\d{2}|\d{4})(?!\d)/u.exec(text)
  if (full) {
    const [day, month, year] = [Number(full[1]), Number(full[2]), expandYear(Number(full[3]))]
    return isValidCalendarDate(year, month, day)
      ? { date: toIso(year, month, day), kind: 'explicit' }
      : null
  }

  const short = /(?<![\d.])(\d{1,2})[./](\d{1,2})(?![\d./])/u.exec(text)
  if (short) {
    const [day, month] = [Number(short[1]), Number(short[2])]
    const year = Number(referenceDate.slice(0, 4))
    return isValidCalendarDate(year, month, day)
      ? { date: toIso(year, month, day), kind: 'inferred' }
      : null
  }

  if (/מחרתיים/u.test(text)) return { date: addDays(referenceDate, 2), kind: 'inferred' }
  if (/(?<!\p{Script=Hebrew})ל?מחר(?!\p{Script=Hebrew})/u.test(text)) {
    return { date: addDays(referenceDate, 1), kind: 'inferred' }
  }
  if (/(?<!\p{Script=Hebrew})ל?היום(?!\p{Script=Hebrew})/u.test(text)) {
    return { date: referenceDate, kind: 'inferred' }
  }

  const weekday = findWeekday(text)
  if (weekday !== null) {
    const daysAhead = (weekday - weekdayOf(referenceDate) + 7) % 7
    return { date: addDays(referenceDate, daysAhead), kind: 'inferred' }
  }

  return null
}
