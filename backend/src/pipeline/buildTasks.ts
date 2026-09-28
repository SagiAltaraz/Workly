import { randomUUID } from 'node:crypto'
import type { TaskSignal } from '../agents/tasks/tasks.schema'
import type { Field } from '../types/provenance'
import type { Task, TaskSignals } from '../types/task'
import { appearsInSource, missingField, sourcedField, type SourceContext } from './fields'
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
  }
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
  })
}

export function buildTime(context: SourceContext, quote: string, timeText: string | null): Field {
  if (!timeText) return missingField()
  const text = normalizeText(timeText)
  const start = parseTimeRange(text).start
  if (!start) return missingField(`לא הצלחתי להבין את השעה "${text}"`)
  return sourcedField(context, {
    value: start.time,
    status: start.kind === 'explicit' ? 'stated' : 'inferred',
    quote,
    evidenceText: text,
  })
}

export function buildTasks(
  context: SourceContext,
  signals: TaskSignal[],
  referenceDate: string,
): Task[] {
  return signals.map((signal) => {
    const quote = normalizeText(signal.quote)
    return {
      id: randomUUID(),
      title: normalizeText(signal.title),
      quote: sourcedField(context, { value: quote, status: 'stated', quote, evidenceText: quote }),
      dueDate: buildDueDate(context, quote, signal.dueDateText, referenceDate),
      dueTime: buildTime(context, quote, signal.dueTimeText),
      signals: buildSignals(context, signal),
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
