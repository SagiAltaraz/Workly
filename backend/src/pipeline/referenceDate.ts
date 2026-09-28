import type { ReferenceDateOrigin } from '../types/workspace'
import { hebrewWeekdays, isValidCalendarDate, todayInIsrael, toIso } from './dateMath'

export interface ReferenceDate {
  date: string
  origin: ReferenceDateOrigin
}

const headingLines = 5
const weekdayPattern = hebrewWeekdays.join('|')
// A heading is a line that *starts* with weekday + date; a sentence that merely
// mentions a deadline ("…עד יום שני, 28.9.2026") is not one.
const headingRegex = new RegExp(
  `^[^\\p{L}\\p{N}]*יום\\s+(?:${weekdayPattern})[\\s,]*(\\d{1,2})[./](\\d{1,2})[./](\\d{4})(?!\\d)`,
  'u',
)

function findDeclaredDate(text: string): string | null {
  for (const line of text.split('\n').slice(0, headingLines)) {
    const match = headingRegex.exec(line.trim())
    if (!match) continue
    const [day, month, year] = [Number(match[1]), Number(match[2]), Number(match[3])]
    if (isValidCalendarDate(year, month, day)) return toIso(year, month, day)
  }
  return null
}

// Order matters: the text itself, then the user's pick, then today in Israel.
export function detectReferenceDate(
  text: string,
  userPick: string | null,
  now: Date = new Date(),
): ReferenceDate {
  const declared = findDeclaredDate(text)
  if (declared) return { date: declared, origin: 'text' }
  if (userPick) return { date: userPick, origin: 'user' }
  return { date: todayInIsrael(now), origin: 'today' }
}
