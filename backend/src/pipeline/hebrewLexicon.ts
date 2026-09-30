import type { DayPart } from '../types/task'

// Everyday Hebrew is written fast: "מחרר", "חמשי", "הצהרים". The words that decide a date or an hour come
// from a small closed set, so a slip of one letter can be read safely. Open text (task titles, names) is
// never touched here.

export interface Correction {
  from: string
  to: string
}

export interface Corrected {
  text: string
  corrections: Correction[]
}

const prefixes = ['', 'ב', 'ל', 'ה', 'מ', 'ו', 'כ', 'ש']
const hebrewWord = /\p{Script=Hebrew}+/gu
// Short words are too close to too many others ("יום" and "היום"), so only longer ones are corrected.
const minimumLength = 4

const dateVocabulary = ['מחר', 'מחרתיים', 'היום', 'אתמול'] as const
const dayPartVocabulary = ['בוקר', 'ערב', 'לילה', 'צהריים'] as const
const weekdays = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'] as const

export function editDistance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, index) => index)
  for (let i = 1; i <= a.length; i += 1) {
    let previous = row[0]
    row[0] = i
    for (let j = 1; j <= b.length; j += 1) {
      const held = row[j]
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1))
      previous = held
    }
  }
  return row[b.length]
}

// The one word of the vocabulary that is exactly one letter away, or null when there is none or two.
// The first letter must match: a slip there is almost always a different word wearing another prefix
// ("ביום" is not a typo of "היום").
function oneLetterAway(word: string, vocabulary: readonly string[]): string | null {
  if (word.length < minimumLength) return null
  const near = vocabulary.filter((candidate) => candidate[0] === word[0] && editDistance(word, candidate) === 1)
  return near.length === 1 ? near[0] : null
}

// A word with an optional prefix letter ("בבוקר" = ב + בוקר), fixed if it is one letter off.
function correctWord(word: string, vocabulary: readonly string[]): string | null {
  if (prefixes.some((prefix) => word.startsWith(prefix) && vocabulary.includes(word.slice(prefix.length)))) return null
  for (const prefix of prefixes) {
    if (!word.startsWith(prefix)) continue
    const fixed = oneLetterAway(word.slice(prefix.length), vocabulary)
    if (fixed) return prefix + fixed
  }
  return null
}

function correctWith(text: string, vocabulary: readonly string[]): Corrected {
  const corrections: Correction[] = []
  const fixed = text.replace(hebrewWord, (word) => {
    const replacement = correctWord(word, vocabulary)
    if (!replacement) return word
    corrections.push({ from: word, to: replacement })
    return replacement
  })
  return { text: fixed, corrections }
}

// "יום חמשי" → "יום חמישי": a weekday is only read as one right after the word "יום".
function correctWeekdays(text: string): Corrected {
  const corrections: Correction[] = []
  const fixed = text.replace(/(יום\s+)(\p{Script=Hebrew}+)/gu, (whole, lead: string, word: string) => {
    const replacement = weekdays.includes(word as (typeof weekdays)[number]) ? null : oneLetterAway(word, weekdays)
    if (!replacement) return whole
    corrections.push({ from: word, to: replacement })
    return `${lead}${replacement}`
  })
  return { text: fixed, corrections }
}

export function correctDateWords(text: string): Corrected {
  const days = correctWeekdays(text)
  const words = correctWith(days.text, dateVocabulary)
  return { text: words.text, corrections: [...days.corrections, ...words.corrections] }
}

export function correctDayPartWords(text: string): Corrected {
  return correctWith(text, dayPartVocabulary)
}

export function describeCorrections(corrections: Correction[]): string | null {
  if (corrections.length === 0) return null
  return `נקרא כך למרות שגיאת כתיב: ${corrections.map((item) => `"${item.from}" ← "${item.to}"`).join(', ')}`
}

const hourWords: [string, number][] = [
  ['אחת עשרה', 11],
  ['אחד עשר', 11],
  ['שתים עשרה', 12],
  ['שנים עשר', 12],
  ['אחת', 1],
  ['אחד', 1],
  ['שתיים', 2],
  ['שתים', 2],
  ['שניים', 2],
  ['שלוש', 3],
  ['שלושה', 3],
  ['ארבע', 4],
  ['ארבעה', 4],
  ['חמש', 5],
  ['חמישה', 5],
  ['שש', 6],
  ['שישה', 6],
  ['שבע', 7],
  ['שבעה', 7],
  ['שמונה', 8],
  ['תשע', 9],
  ['תשעה', 9],
  ['עשר', 10],
  ['עשרה', 10],
]

const hourWordsByLength = [...hourWords].sort((a, b) => b[0].length - a[0].length)
export const hourWordPattern = hourWordsByLength.map(([word]) => word).join('|')
const hourWordValue = new Map(hourWords)

export function hourFromWordOrDigits(token: string): number | null {
  if (/^\d{1,2}$/.test(token)) return Number(token)
  return hourWordValue.get(token) ?? null
}

// "שמונה וחצי" → "8 וחצי", "בעשר" → "ב-10". Only meant for words the model copied as a time; a number
// word elsewhere in a sentence ("שלוש משימות") is never passed through here.
export function numberWordsToDigits(text: string): string {
  const pattern = new RegExp(`(?<!\\p{Script=Hebrew})([בל]?)(${hourWordPattern})(?!\\p{Script=Hebrew})`, 'gu')
  return text.replace(pattern, (_whole, prefix: string, word: string) => `${prefix ? `${prefix}-` : ''}${hourWordValue.get(word)}`)
}

// "רבע לשמונה" → "7:45", "עשרה ל-8" → "7:50": minutes before an hour.
export function expandMinutesBefore(text: string): string {
  const pattern = new RegExp(
    `(?<!\\p{Script=Hebrew})(רבע|עשרה|עשרים|חמש דקות)\\s+ל-?\\s*(${hourWordPattern}|\\d{1,2})(?!\\p{Script=Hebrew})`,
    'gu',
  )
  const minutesOf: Record<string, number> = { רבע: 15, עשרה: 10, עשרים: 20, 'חמש דקות': 5 }
  return text.replace(pattern, (whole, before: string, hourToken: string) => {
    const hour = hourFromWordOrDigits(hourToken)
    if (hour === null || hour < 1 || hour > 12) return whole
    const previousHour = hour === 1 ? 12 : hour - 1
    return `${previousHour}:${String(60 - minutesOf[before]).padStart(2, '0')}`
  })
}

// A part of the day with no hour ("בבוקר", "אחה"צ") is a window, not a clock time.
export function dayPartOf(text: string): DayPart | null {
  const fixed = correctDayPartWords(text).text
  if (/אחר הצהריים|אחה"צ/u.test(fixed)) return 'afternoon'
  if (/(?<!\p{Script=Hebrew})[בה]?צהריים/u.test(fixed)) return 'noon'
  if (/(?<!\p{Script=Hebrew})[בה]?בוקר/u.test(fixed)) return 'morning'
  if (/(?<!\p{Script=Hebrew})[בה]?ערב/u.test(fixed)) return 'evening'
  if (/(?<!\p{Script=Hebrew})[בה]?לילה/u.test(fixed)) return 'night'
  return null
}
