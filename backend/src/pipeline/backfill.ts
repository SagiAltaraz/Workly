import type { Field } from '../types/provenance'
import type { Workspace } from '../types/workspace'
import { addDays, israelClock, timeToMinutes } from './dateMath'

// Cards saved before a day was inferred for them have no day. This gives them the day they would have got
// when they were typed: today, or tomorrow if their hour had already passed then.
// It only touches a card whose day is empty and untouched, and it is idempotent.
export function backfillDays(workspace: Workspace): Workspace {
  const sources = new Map(workspace.sources.map((source) => [source.id, source]))

  const inferredDay = (quote: Field, time: string): Field | null => {
    const source = quote.span ? sources.get(quote.span.inputId) : undefined
    if (!source) return null
    const clock = israelClock(new Date(source.addedAt))
    const passed = source.referenceDate === clock.date && timeToMinutes(time) <= clock.minutes
    return {
      value: passed ? addDays(source.referenceDate, 1) : source.referenceDate,
      status: 'inferred',
      quote: quote.value,
      span: quote.span,
      verified: quote.verified,
      editedByUser: false,
      note: passed ? 'השעה כבר עברה היום, ולכן נקבע למחר' : null,
    }
  }

  // A card typed with no day and no hour was left undated; it is for the day it was typed.
  const defaultDay = (quote: Field): Field | null => {
    const source = quote.span ? sources.get(quote.span.inputId) : undefined
    if (!source) return null
    return {
      value: source.referenceDate,
      status: 'inferred',
      quote: quote.value,
      span: quote.span,
      verified: quote.verified,
      editedByUser: false,
      note: 'לא צוין יום, ולכן נקבע להיום',
    }
  }

  const untouched = (date: Field) => date.value === null && date.note === null && !date.editedByUser

  return {
    ...workspace,
    tasks: workspace.tasks.map((task) => {
      const placed = task.signals.listedUnder !== null || task.signals.canWait !== null
      // A task that waits on a meeting takes its day from that meeting.
      if (!untouched(task.dueDate) || placed || task.meetingLink !== null) return task
      const day = task.dueTime.value !== null ? inferredDay(task.quote, task.dueTime.value) : defaultDay(task.quote)
      return day ? { ...task, dueDate: day } : task
    }),
    meetings: workspace.meetings.map((meeting) => {
      if (!untouched(meeting.date) || meeting.startTime.value === null) return meeting
      const day = inferredDay(meeting.quote, meeting.startTime.value)
      return day ? { ...meeting, date: day } : meeting
    }),
  }
}
