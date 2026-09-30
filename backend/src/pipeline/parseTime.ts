import { formatTime } from './dateMath'
import { correctDayPartWords, expandMinutesBefore, numberWordsToDigits } from './hebrewLexicon'

export interface ParsedTime {
  time: string
  // 'explicit' is a written HH:MM; anything read from Hebrew wording is 'inferred'.
  kind: 'explicit' | 'inferred'
}

const partOfDay = 'בבוקר|בערב|בלילה|בצהריים|אחה"צ|אחר הצהריים'
const notHebrewLetter = String.raw`(?!\p{Script=Hebrew})`
const fractions = 'וחצי|ורבע|ועשרה|ועשרים|וחמש'

// One pass, leftmost match wins, so an explicit HH:MM is never re-read by a looser form.
const timePattern = new RegExp(
  [
    // 1: explicit HH:MM, optionally with a part of the day ("8:30 בערב")
    String.raw`(?<![\d.:])(?<eh>\d{1,2}):(?<em>\d{2})(?![\d:])(?:\s+(?<ep>${partOfDay})${notHebrewLetter})?`,
    // 2: "בשעה 8", "בשעה 8 וחצי", "בשעה 8 בערב", and "לשעה 11" (a meeting moved to an hour)
    String.raw`[בל]שעה\s+(?<sh>\d{1,2})(?!\d|:\d)(?:\s+(?<sf>${fractions}))?(?:\s+(?<sp>${partOfDay})${notHebrewLetter})?`,
    // 3: "9 בבוקר", "ב-9 בבוקר", "8 בערב", "8 וחצי בערב"
    String.raw`(?<![\d.:/-])(?:ב-)?(?<ph>\d{1,2})(?:\s+(?<pf>${fractions}))?\s+(?<pp>${partOfDay})${notHebrewLetter}`,
    // 4: a bare "ב-9", or "ב-10 וחצי". The leading ב is the only signal, so a date like "ב-5.10" is excluded.
    String.raw`(?<![\p{Script=Hebrew}\d])ב-(?<bh>\d{1,2})(?!\d|[.:/]\d)(?:\s+(?<bf>${fractions}))?`,
    // 5: "until noon" is a deadline at twelve
    String.raw`עד\s+(?:ה)?(?<noon>צהריים)${notHebrewLetter}`,
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
  switch (word) {
    case 'וחצי':
      return 30
    case 'ורבע':
      return 15
    case 'ועשרה':
      return 10
    case 'ועשרים':
      return 20
    case 'וחמש':
      return 5
    default:
      return 0
  }
}

function build(hour: number, minutes: number, kind: ParsedTime['kind']): ParsedTime | null {
  if (hour < 0 || hour > 23 || minutes < 0 || minutes > 59) return null
  return { time: formatTime(hour, minutes), kind }
}

// Slips of one letter and number words are read first: "הצהרים" → "הצהריים", "שמונה וחצי" → "8 וחצי",
// "רבע לשמונה" → "7:45". The patterns below then only ever see digits.
function prepare(text: string): string {
  return numberWordsToDigits(expandMinutesBefore(correctDayPartWords(text).text))
}

// Every clock time in the text, in reading order.
export function findTimes(text: string): ParsedTime[] {
  const found: ParsedTime[] = []
  for (const match of prepare(text).matchAll(timePattern)) {
    const g = match.groups ?? {}
    let parsed: ParsedTime | null = null
    if (g.eh !== undefined) {
      // A part of the day after an hour that could be either half of the day ("8:30 בערב") settles it.
      const hour = g.ep !== undefined && Number(g.eh) <= 11 ? applyPartOfDay(Number(g.eh), g.ep) : Number(g.eh)
      parsed = build(hour, Number(g.em), g.ep !== undefined ? 'inferred' : 'explicit')
    } else if (g.sh !== undefined) {
      parsed = build(applyPartOfDay(Number(g.sh), g.sp), fractionMinutes(g.sf), 'inferred')
    } else if (g.ph !== undefined) {
      parsed = build(applyPartOfDay(Number(g.ph), g.pp), fractionMinutes(g.pf), 'inferred')
    } else if (g.bh !== undefined) {
      parsed = build(Number(g.bh), fractionMinutes(g.bf), 'inferred')
    } else if (g.noon !== undefined) {
      parsed = build(12, 0, 'inferred')
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
