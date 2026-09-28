import type { Meeting } from '../types/meeting'

const lineBreak = '\r\n'

function escapeText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

function stamp(iso: string, time: string): string {
  return `${iso.replaceAll('-', '')}T${time.replace(':', '')}00`
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
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Workly//HE', ...events, 'END:VCALENDAR', ''].join(lineBreak)
}

export function downloadIcs(filename: string, content: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/calendar;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
