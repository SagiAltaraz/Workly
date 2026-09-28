import { randomUUID } from 'node:crypto'
import type { MeetingSignal } from '../agents/meetings/meetings.schema'
import type { Meeting } from '../types/meeting'
import { buildDueDate, buildTime, listedUnderOf } from './buildTasks'
import { appearsInSource, missingField, sourcedField, type SourceContext } from './fields'
import { normalizeText } from './normalize'
import { findWeekday } from './parseDate'
import { parseTimeRange } from './parseTime'
import type { Field } from '../types/provenance'

function meetingDate(
  context: SourceContext,
  signal: MeetingSignal,
  quote: string,
  referenceDate: string,
): Field {
  if (signal.dateText) return buildDueDate(context, quote, signal.dateText, referenceDate)
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

    return {
      id: randomUUID(),
      topic: normalizeText(signal.topic),
      quote: sourcedField(context, { value: quote, status: 'stated', quote, evidenceText: quote }),
      weekdayWritten,
      date: meetingDate(context, signal, quote, referenceDate),
      startTime: buildTime(context, quote, signal.timeText),
      endTime: endTimeField(context, quote, signal.timeText),
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
