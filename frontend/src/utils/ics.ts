import type { Meeting } from '../types/meeting'
import type { Task } from '../types/task'
import { addDays } from './isoDate'

const lineBreak = '\r\n'

function escapeText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

function stamp(iso: string, time: string): string {
  return `${iso.replaceAll('-', '')}T${time.replace(':', '')}00`
}

function dateStamp(iso: string): string {
  return iso.replaceAll('-', '')
}

// Half an hour ending at the deadline, so the block reads as "due", not "starting".
function shiftedStamp(date: string, time: string, minutes: number): string {
  const [year, month, day] = date.split('-').map(Number)
  const [hour, minute] = time.split(':').map(Number)
  const shifted = new Date(Date.UTC(year, month - 1, day, hour, minute) + minutes * 60_000)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${shifted.getUTCFullYear()}${pad(shifted.getUTCMonth() + 1)}${pad(shifted.getUTCDate())}T${pad(shifted.getUTCHours())}${pad(shifted.getUTCMinutes())}00`
}

function wrapCalendar(events: string[]): string {
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Workly//HE', ...events, 'END:VCALENDAR', ''].join(lineBreak)
}

// Floating local times, no timezone: the phone shows the meeting at the hour written in the text.
export function buildIcs(meetings: Meeting[], now: Date = new Date()): string {
  const created = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const events = meetings.flatMap((meeting) => {
    const date = meeting.date.value
    const start = meeting.startTime.value
    if (!date || !start) return []
    const end = meeting.endTime.value ?? start
    return [
      'BEGIN:VEVENT',
      `UID:${meeting.id}@workly`,
      `DTSTAMP:${created}`,
      `DTSTART:${stamp(date, start)}`,
      `DTEND:${stamp(date, end)}`,
      `SUMMARY:${escapeText(meeting.topic)}`,
      ...(meeting.participants.length > 0
        ? [`DESCRIPTION:${escapeText(`משתתפים: ${meeting.participants.join(', ')}`)}`]
        : []),
      'END:VEVENT',
    ]
  })
  return wrapCalendar(events)
}

// A task with no due date has nothing to export. One with a time becomes a 30-minute block ending at
// the deadline; one with only a date becomes an all-day reminder. The deadline (the task's own, or its
// meeting's when the task states none) is what's exported, matching what the card itself shows.
export function buildTaskIcs(tasks: Task[], now: Date = new Date()): string {
  const created = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const events = tasks.flatMap((task) => {
    const date = task.deadline.date ?? task.dueDate.value
    if (!date) return []
    const time = task.deadline.time ?? task.dueTime.value
    const timing = time
      ? [`DTSTART:${stamp(date, time)}`, `DTEND:${shiftedStamp(date, time, 30)}`]
      : [`DTSTART;VALUE=DATE:${dateStamp(date)}`, `DTEND;VALUE=DATE:${dateStamp(addDays(date, 1))}`]
    return ['BEGIN:VEVENT', `UID:${task.id}@workly`, `DTSTAMP:${created}`, ...timing, `SUMMARY:${escapeText(task.title)}`, 'END:VEVENT']
  })
  return wrapCalendar(events)
}

export function downloadIcs(filename: string, content: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/calendar;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
