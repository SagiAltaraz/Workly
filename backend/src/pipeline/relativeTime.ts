import { addDays, formatTime, israelClock } from './dateMath'
import { numberWordsToDigits } from './hebrewLexicon'

export interface Moment {
  date: string
  time: string
}

const minutesPerDay = 24 * 60

// "In an hour", "in half an hour", "in two hours", "in 20 minutes": a moment counted from the real
// clock in Israel. Needs the current time, so it can never be answered from the text alone.
export function parseRelativeMoment(text: string, now: Date): Moment | null {
  const words = numberWordsToDigits(text)
  const later = (minutes: number): Moment => {
    const clock = israelClock(now)
    const total = clock.minutes + minutes
    const days = Math.floor(total / minutesPerDay)
    const inDay = ((total % minutesPerDay) + minutesPerDay) % minutesPerDay
    return { date: addDays(clock.date, days), time: formatTime(Math.floor(inDay / 60), inDay % 60) }
  }
  const after = String.raw`(?<!\p{Script=Hebrew})ב?עוד\s+`
  const end = String.raw`(?!\p{Script=Hebrew})`

  if (new RegExp(`${after}שעה\\s+וחצי${end}`, 'u').test(words)) return later(90)
  if (new RegExp(`${after}שעתיים${end}`, 'u').test(words)) return later(120)
  if (new RegExp(`${after}חצי\\s+שעה${end}`, 'u').test(words)) return later(30)
  if (new RegExp(`${after}רבע\\s+שעה${end}`, 'u').test(words)) return later(15)
  if (new RegExp(`${after}שעה${end}`, 'u').test(words)) return later(60)

  const hours = new RegExp(`${after}(\\d{1,2})\\s+שעות${end}`, 'u').exec(words)
  if (hours) return later(Number(hours[1]) * 60)
  const minutes = new RegExp(`${after}(\\d{1,3})\\s+דקות${end}`, 'u').exec(words)
  if (minutes) return later(Number(minutes[1]))
  return null
}
