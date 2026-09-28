import { findWeekday } from './parseDate'
import { timeToMinutes, weekdayOf } from './dateMath'
import type { Meeting } from '../types/meeting'

interface Slot {
  start: number
  end: number
}

function slotOf(meeting: Meeting): Slot | null {
  if (!meeting.date.value || !meeting.startTime.value) return null
  const start = timeToMinutes(meeting.startTime.value)
  // A meeting without an end still occupies its start minute.
  const end = meeting.endTime.value ? timeToMinutes(meeting.endTime.value) : start + 1
  return { start, end: Math.max(end, start + 1) }
}

function overlaps(a: Slot, b: Slot): boolean {
  return a.start < b.end && b.start < a.end
}

// Cross-checks the written weekday against the date, marks meetings with no agreed time, and
// flags same-day overlaps. It never fixes anything; a mismatch becomes a question.
export function flagMeetings(meetings: Meeting[]): Meeting[] {
  return meetings.map((meeting) => {
    const date = meeting.date.value
    const written = meeting.weekdayWritten ? findWeekday(meeting.weekdayWritten) : null
    const slot = slotOf(meeting)

    const conflictsWith =
      slot === null
        ? []
        : meetings
            .filter((other) => other.id !== meeting.id && !other.deleted && other.date.value === date)
            .filter((other) => {
              const otherSlot = slotOf(other)
              return otherSlot !== null && overlaps(slot, otherSlot)
            })
            .map((other) => other.id)

    return {
      ...meeting,
      awaitingScheduling: date === null || meeting.startTime.value === null,
      weekdayMismatch: date !== null && written !== null && written !== weekdayOf(date),
      conflictsWith,
    }
  })
}
