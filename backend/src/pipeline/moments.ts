import type { Field } from '../types/provenance'
import type { DayPart } from '../types/task'
import { addDays, israelClock, timeToMinutes } from './dateMath'
import { sourcedField, type SourceContext } from './fields'
import { normalizeText } from './normalize'
import { parseRelativeMoment } from './relativeTime'

// "In an hour" gives both a day and an hour, counted from the moment the text arrived. Null when the
// words are not a wait, so the ordinary reading of dates and hours goes on.
export function relativeFields(
  context: SourceContext,
  quote: string,
  timeText: string | null,
): { date: Field; time: Field } | null {
  if (!timeText) return null
  const text = normalizeText(timeText)
  const moment = parseRelativeMoment(text, context.now ?? new Date())
  if (!moment) return null
  const read = (value: string) => sourcedField(context, { value, status: 'inferred', quote, evidenceText: text })
  return { date: read(moment.date), time: read(moment.time) }
}

// How late a part of the day runs. Once it is over, "in the morning" said in the afternoon is tomorrow's.
const windowEnds: Record<DayPart, number> = {
  morning: 12 * 60,
  noon: 14 * 60,
  afternoon: 18 * 60,
  evening: 23 * 60,
  night: 24 * 60,
}

interface When {
  time: string | null
  dayPart: DayPart | null
}

// The day a clock time or a part of the day belongs to when the text names no day: today, and tomorrow
// when that moment has already gone by. Only the real today can have gone by: for a text that declares
// its own day (last week's list) the clock says nothing.
export function dayFromClock(
  context: SourceContext,
  quote: string,
  timeText: string,
  referenceDate: string,
  when: When,
): Field {
  const clock = israelClock(context.now ?? new Date())
  const deadline = when.time !== null ? timeToMinutes(when.time) : windowEnds[when.dayPart ?? 'night']
  const passed = referenceDate === clock.date && deadline <= clock.minutes
  return sourcedField(context, {
    value: passed ? addDays(referenceDate, 1) : referenceDate,
    status: 'inferred',
    quote,
    evidenceText: normalizeText(timeText),
    note: passed ? 'השעה כבר עברה היום, ולכן נקבע למחר' : null,
  })
}
