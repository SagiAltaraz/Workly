import { randomUUID } from 'node:crypto'
import type { TaskSignal } from '../agents/tasks/tasks.schema'
import type { Field } from '../types/provenance'
import type { Task, TaskSignals } from '../types/task'
import { appearsInSource, missingField, sourcedField, type SourceContext } from './fields'
import { dayPartOf, describeCorrections } from './hebrewLexicon'
import { dayFromClock, relativeFields } from './moments'
import { normalizeText } from './normalize'
import { parseDate } from './parseDate'
import { parseTimeRange } from './parseTime'

export function listedUnderOf(heading: string | null): 'today' | 'week' | null {
  if (!heading) return null
  if (/להיום|היום/.test(heading)) return 'today'
  if (/השבוע|להמשך/.test(heading)) return 'week'
  return null
}

// A signal only counts when its words really appear in the source text.
function verifiedSignal(context: SourceContext, text: string | null): string | null {
  if (!text) return null
  const cleaned = normalizeText(text)
  return cleaned.length > 0 && appearsInSource(context, cleaned) ? cleaned : null
}

function buildSignals(context: SourceContext, signal: TaskSignal): TaskSignals {
  const canWaitQuote = signal.canWait ? verifiedSignal(context, signal.canWait.quote) : null
  return {
    urgency: verifiedSignal(context, signal.urgencyWording),
    externalWaiting: verifiedSignal(context, signal.externalWaiting),
    blocksOthers: verifiedSignal(context, signal.blocksOthers),
    condition: verifiedSignal(context, signal.condition),
    canWait: signal.canWait && canWaitQuote ? signal.canWait.kind : null,
    notUrgent: verifiedSignal(context, signal.notUrgent),
    listedUnder: verifiedSignal(context, signal.sectionHeading)
      ? listedUnderOf(signal.sectionHeading)
      : null,
    dayPart: null,
  }
}

// Only words that really are in the text can tie a task to a meeting. Which meeting they name is
// decided later, by code, once the meetings are known.
function buildMeetingLink(context: SourceContext, phrase: string | null): Task['meetingLink'] {
  const verified = verifiedSignal(context, phrase)
  return verified ? { phrase: verified, meetingId: null } : null
}

export function buildDueDate(
  context: SourceContext,
  quote: string,
  dateText: string | null,
  referenceDate: string,
): Field {
  if (!dateText) return missingField()
  const text = normalizeText(dateText)
  const parsed = parseDate(text, referenceDate)
  if (!parsed) return missingField(`לא הצלחתי להבין את התאריך "${text}"`)
  return sourcedField(context, {
    value: parsed.date,
    status: parsed.kind === 'explicit' ? 'stated' : 'inferred',
    quote,
    evidenceText: text,
    note: describeCorrections(parsed.corrections),
  })
}

export function buildTime(context: SourceContext, quote: string, timeText: string | null): Field {
  if (!timeText) return missingField()
  const text = normalizeText(timeText)
  const start = parseTimeRange(text).start
  // "בבוקר" or "אחה"צ" alone is a part of the day, not an hour that failed to parse: nothing to ask.
  if (!start && dayPartOf(text)) return missingField()
  if (!start) return missingField(`לא הצלחתי להבין את השעה "${text}"`)
  return sourcedField(context, {
    value: start.time,
    status: start.kind === 'explicit' ? 'stated' : 'inferred',
    quote,
    evidenceText: text,
  })
}

interface TodayInput {
  hasMeetingLink: boolean
  dueTime: Field
  taskSignals: TaskSignals
  quote: string
  timeText: string | null
  context: SourceContext
  referenceDate: string
}

// A task with no day is for today. "Before 19:00" is today, and tomorrow if that hour has already passed;
// a task with no hour at all is simply today. Left alone are a task a heading already placed ("tasks for
// the rest of the week"), one that waits on a meeting (its day comes from that meeting), and one whose
// written date could not be read (that is a question, not a guess).
function dateOrToday(dueDate: Field, input: TodayInput): Field {
  const { hasMeetingLink, dueTime, taskSignals, quote, timeText, context, referenceDate } = input
  const hasPlace = taskSignals.listedUnder !== null || taskSignals.canWait !== null
  const unreadable = dueDate.status === 'missing' && dueDate.note !== null
  if (dueDate.value !== null || unreadable || hasPlace || hasMeetingLink) return dueDate

  const hasWhen = dueTime.value !== null || taskSignals.dayPart !== null
  if (hasWhen && timeText) {
    return dayFromClock(context, quote, timeText, referenceDate, { time: dueTime.value, dayPart: taskSignals.dayPart })
  }
  return sourcedField(context, {
    value: referenceDate,
    status: 'inferred',
    quote,
    evidenceText: quote,
    note: 'לא צוין יום, ולכן נקבע להיום',
  })
}

export function buildTasks(
  context: SourceContext,
  signals: TaskSignal[],
  referenceDate: string,
): Task[] {
  return signals.map((signal) => {
    const quote = normalizeText(signal.quote)
    // "In an hour" is counted from the clock; anything else is read from the words.
    const relative = signal.dueDateText ? null : relativeFields(context, quote, signal.dueTimeText)
    const dueTime = relative?.time ?? buildTime(context, quote, signal.dueTimeText)
    const dayPart = dueTime.value === null && signal.dueTimeText ? dayPartOf(normalizeText(signal.dueTimeText)) : null
    const taskSignals = { ...buildSignals(context, signal), dayPart }
    const meetingLink = buildMeetingLink(context, signal.relatedMeetingText)
    return {
      id: randomUUID(),
      title: normalizeText(signal.title),
      quote: sourcedField(context, { value: quote, status: 'stated', quote, evidenceText: quote }),
      dueDate:
        relative?.date ??
        dateOrToday(buildDueDate(context, quote, signal.dueDateText, referenceDate), {
          hasMeetingLink: meetingLink !== null,
          dueTime,
          taskSignals,
          quote,
          timeText: signal.dueTimeText,
          context,
          referenceDate,
        }),
      dueTime,
      signals: taskSignals,
      meetingLink,
      deadline: { date: null, time: null, meetingId: null },
      done: false,
      deleted: false,
      blocked: false,
      bucket: 'later',
      priority: null,
      rule: 'p4Later',
      reason: '',
    }
  })
}
