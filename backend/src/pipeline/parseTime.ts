import { formatTime } from './dateMath'

export interface ParsedTime {
  time: string
  // 'explicit' is a written HH:MM; anything read from Hebrew wording is 'inferred'.
  kind: 'explicit' | 'inferred'
}

const partOfDay = 'בבוקר|בערב|בלילה|בצהריים|אחה"צ|אחר הצהריים'
const notHebrewLetter = String.raw`(?!\p{Script=Hebrew})`

// One pass, leftmost match wins, so an explicit HH:MM is never re-read by a looser form.
const timePattern = new RegExp(
  [
    // 1: explicit HH:MM
    String.raw`(?<![\d.:])(?<eh>\d{1,2}):(?<em>\d{2})(?![\d:])`,
    // 2: "בשעה 8", "בשעה 8 וחצי", "בשעה 8 בערב", and "לשעה 11" (a meeting moved to an hour)
    String.raw`[בל]שעה\s+(?<sh>\d{1,2})(?!\d|:\d)(?:\s+(?<sf>וחצי|ורבע))?(?:\s+(?<sp>${partOfDay})${notHebrewLetter})?`,
    // 3: "9 בבוקר", "ב-9 בבוקר", "8 בערב", "8 וחצי בערב"
    String.raw`(?<![\d.:/-])(?:ב-)?(?<ph>\d{1,2})(?:\s+(?<pf>וחצי|ורבע))?\s+(?<pp>${partOfDay})${notHebrewLetter}`,
    // 4: a bare "ב-9". The leading ב is the only signal, so a date like "ב-5.10" is excluded.
    String.raw`(?<![\p{Script=Hebrew}\d])ב-(?<bh>\d{1,2})(?!\d|[.:/]\d)`,
  ].join('|'),
  'gu',
)

function applyPartOfDay(hour: number, part: string | undefined): number {
  switch (part) {
    case 'בערב':
    case 'אחה"צ':
    case 'אחר הצהריים':
      return hour >= 1 && hour <= 11 ? hour + 12 : hour
    case 'בלילה':
      if (hour === 12) return 0
      return hour >= 6 && hour <= 11 ? hour + 12 : hour
    case 'בצהריים':
      return hour >= 1 && hour <= 4 ? hour + 12 : hour
    default:
      return hour
  }
}

function fractionMinutes(word: string | undefined): number {
  if (word === 'וחצי') return 30
  if (word === 'ורבע') return 15
  return 0
}

function build(hour: number, minutes: number, kind: ParsedTime['kind']): ParsedTime | null {
  if (hour < 0 || hour > 23 || minutes < 0 || minutes > 59) return null
  return { time: formatTime(hour, minutes), kind }
}

// Every clock time in the text, in reading order.
export function findTimes(text: string): ParsedTime[] {
  const found: ParsedTime[] = []
  for (const match of text.matchAll(timePattern)) {
    const g = match.groups ?? {}
    let parsed: ParsedTime | null = null
    if (g.eh !== undefined) {
      parsed = build(Number(g.eh), Number(g.em), 'explicit')
    } else if (g.sh !== undefined) {
      parsed = build(applyPartOfDay(Number(g.sh), g.sp), fractionMinutes(g.sf), 'inferred')
    } else if (g.ph !== undefined) {
      parsed = build(applyPartOfDay(Number(g.ph), g.pp), fractionMinutes(g.pf), 'inferred')
    } else if (g.bh !== undefined) {
      parsed = build(Number(g.bh), 0, 'inferred')
    }
    if (parsed) found.push(parsed)
  }
  return found
}

export interface ParsedTimeRange {
  start: ParsedTime | null
  end: ParsedTime | null
}

export function parseTimeRange(text: string): ParsedTimeRange {
  const times = findTimes(text)
  return { start: times[0] ?? null, end: times[1] ?? null }
}
