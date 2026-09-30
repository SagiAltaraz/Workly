import { randomUUID } from 'node:crypto'
import type { MeetingSignal } from '../agents/meetings/meetings.schema'
import type { Meeting } from '../types/meeting'
import { buildDueDate, buildTime, listedUnderOf } from './buildTasks'
import { appearsInSource, missingField, sourcedField, type SourceContext } from './fields'
import { dayPartOf } from './hebrewLexicon'
import { dayFromClock, relativeFields } from './moments'
import { normalizeText } from './normalize'
import { findWeekday } from './parseDate'
import { parseTimeRange } from './parseTime'
import type { Field } from '../types/provenance'

function meetingDate(
  context: SourceContext,
  signal: MeetingSignal,
  quote: string,
  referenceDate: string,
  weekdayWritten: string | null,
): Field {
  if (signal.dateText) return buildDueDate(context, quote, signal.dateText, referenceDate)
  // A weekday and no date ("on Thursday") is the next such day, counted by code from the reference date.
  if (weekdayWritten) return buildDueDate(context, quote, weekdayWritten, referenceDate)
  // Listed under a "today" heading: the date is the reference date, derived from that heading.
  if (signal.sectionHeading && listedUnderOf(signal.sectionHeading) === 'today') {
    return sourcedField(context, {
      value: referenceDate,
      status: 'inferred',
      quote: signal.sectionHeading,
      evidenceText: normalizeText(signal.sectionHeading),
    })
  }
  return missingField()
}

function endTimeField(context: SourceContext, quote: string, timeText: string | null): Field {
  if (!timeText) return missingField()
  const end = parseTimeRange(normalizeText(timeText)).end
  if (!end) return missingField()
  return sourcedField(context, {
    value: end.time,
    status: end.kind === 'explicit' ? 'stated' : 'inferred',
    quote,
    evidenceText: normalizeText(timeText),
  })
}

export function buildMeetings(
  context: SourceContext,
  signals: MeetingSignal[],
  referenceDate: string,
): Meeting[] {
  return signals.map((signal) => {
    const quote = normalizeText(signal.quote)
    const weekdayText = signal.weekdayText ? normalizeText(signal.weekdayText) : null
    const weekdayWritten =
      weekdayText && appearsInSource(context, weekdayText) && findWeekday(weekdayText) !== null
        ? weekdayText
        : null

    const relative = signal.dateText ? null : relativeFields(context, quote, signal.timeText)
    const startTime = relative?.time ?? buildTime(context, quote, signal.timeText)
    const dayPart = startTime.value === null && signal.timeText ? dayPartOf(normalizeText(signal.timeText)) : null
    const stated = relative?.date ?? meetingDate(context, signal, quote, referenceDate, weekdayWritten)
    // A meeting with an hour (or a part of the day) and no day at all is today, or tomorrow if it has passed.
    const placedByHeading = signal.sectionHeading !== null && listedUnderOf(signal.sectionHeading) !== null
    const date =
      stated.value === null && stated.note === null && signal.timeText && !placedByHeading && (startTime.value !== null || dayPart !== null)
        ? dayFromClock(context, quote, signal.timeText, referenceDate, { time: startTime.value, dayPart })
        : stated
    return {
      id: randomUUID(),
      topic: normalizeText(signal.topic),
      quote: sourcedField(context, { value: quote, status: 'stated', quote, evidenceText: quote }),
      weekdayWritten,
      date,
      startTime,
      endTime: endTimeField(context, quote, signal.timeText),
      dayPart,
      participants: signal.participants
        .map(normalizeText)
        .filter((name) => name.length > 0 && appearsInSource(context, name)),
      awaitingScheduling: false,
      weekdayMismatch: false,
      conflictsWith: [],
      deleted: false,
    }
  })
}
