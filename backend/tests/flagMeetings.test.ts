import { describe, expect, it } from 'vitest'
import { flagMeetings } from '../src/pipeline/flagMeetings'
import { makeMeeting } from './helpers'

describe('flagMeetings', () => {
  it('flags overlapping meetings on the same day, both ways', () => {
    const [a, b] = flagMeetings([
      makeMeeting({ id: 'a', date: '2026-09-24', start: '09:30', end: '10:00' }),
      makeMeeting({ id: 'b', date: '2026-09-24', start: '09:45', end: '10:15' }),
    ])
    expect(a.conflictsWith).toEqual(['b'])
    expect(b.conflictsWith).toEqual(['a'])
  })

  it('does not flag back-to-back meetings or different days', () => {
    const flagged = flagMeetings([
      makeMeeting({ id: 'a', date: '2026-09-24', start: '10:00', end: '10:30' }),
      makeMeeting({ id: 'b', date: '2026-09-24', start: '10:30', end: '11:00' }),
      makeMeeting({ id: 'c', date: '2026-09-25', start: '10:00', end: '10:30' }),
    ])
    expect(flagged.every((meeting) => meeting.conflictsWith.length === 0)).toBe(true)
  })

  it('treats two meetings starting at the same minute as a conflict even without end times', () => {
    const [a] = flagMeetings([
      makeMeeting({ id: 'a', date: '2026-09-24', start: '10:00' }),
      makeMeeting({ id: 'b', date: '2026-09-24', start: '10:00' }),
    ])
    expect(a.conflictsWith).toEqual(['b'])
  })

  it('reports a meeting with no agreed time as awaiting scheduling instead of dropping it', () => {
    const [noTime, noDate] = flagMeetings([
      makeMeeting({ id: 'a', date: '2026-09-24' }),
      makeMeeting({ id: 'b', start: '10:00' }),
    ])
    expect(noTime.awaitingScheduling).toBe(true)
    expect(noDate.awaitingScheduling).toBe(true)
  })

  it('cross-checks the written weekday against the date without fixing it', () => {
    const [ok, wrong] = flagMeetings([
      makeMeeting({ id: 'a', weekdayWritten: 'יום חמישי', date: '2026-09-24', start: '09:30' }),
      makeMeeting({ id: 'b', weekdayWritten: 'יום שלישי', date: '2026-09-24', start: '09:30' }),
    ])
    expect(ok.weekdayMismatch).toBe(false)
    expect(wrong.weekdayMismatch).toBe(true)
    expect(wrong.date.value).toBe('2026-09-24')
  })
})

