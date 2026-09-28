import type { Meeting } from '../types/meeting'

export function timeRange(meeting: Meeting): string | null {
  const { value: start } = meeting.startTime
  if (!start) return null
  return meeting.endTime.value ? `${start}–${meeting.endTime.value}` : start
}
