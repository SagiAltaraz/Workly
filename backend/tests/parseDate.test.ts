import { describe, expect, it } from 'vitest'
import { findWeekday, parseDate } from '../src/pipeline/parseDate'
import { addDays, todayInIsrael, weekdayOf } from '../src/pipeline/dateMath'

const ref = '2026-09-23' // a Wednesday

describe('parseDate', () => {
  it('reads a full written date as explicit', () => {
    expect(parseDate('ביום חמישי, 24.9.2026', ref)).toEqual({ date: '2026-09-24', kind: 'explicit' })
  })

  it('infers the year when the text gives only day and month', () => {
    expect(parseDate('עד 28.9', ref)).toEqual({ date: '2026-09-28', kind: 'inferred' })
    expect(parseDate('ב-5.10', ref)).toEqual({ date: '2026-10-05', kind: 'inferred' })
  })

  it('resolves relative words against the reference date', () => {
    expect(parseDate('היום', ref)?.date).toBe('2026-09-23')
    expect(parseDate('עד סוף היום', ref)?.date).toBe('2026-09-23')
    expect(parseDate('מחר', ref)?.date).toBe('2026-09-24')
    expect(parseDate('למחר', ref)?.date).toBe('2026-09-24')
    expect(parseDate('מחרתיים', ref)?.date).toBe('2026-09-25')
  })

  it('resolves a bare weekday to its next occurrence', () => {
    expect(parseDate('ביום שני', ref)).toEqual({ date: '2026-09-28', kind: 'inferred' })
  })

  it('returns null for impossible or missing dates', () => {
    expect(parseDate('31.2.2026', ref)).toBeNull()
    expect(parseDate('בסוף השבוע', ref)).toBeNull()
  })

  it('does not treat a time as a date', () => {
    expect(parseDate('עד 11:00', ref)).toBeNull()
  })
})

describe('weekday and date math', () => {
  it('finds a written weekday', () => {
    expect(findWeekday('ביום שני, 28.9.2026')).toBe(1)
    expect(findWeekday('יום שבת')).toBe(6)
    expect(findWeekday('סתם טקסט')).toBeNull()
  })

  it('computes weekdays from ISO dates', () => {
    expect(weekdayOf('2026-09-28')).toBe(1)
    expect(weekdayOf('2026-10-04')).toBe(0)
  })

  it('adds days across a month boundary', () => {
    expect(addDays('2026-09-30', 1)).toBe('2026-10-01')
  })

  it('takes the date in Israel, not the raw UTC clock', () => {
    // 22:30 UTC on Sept 23 is already Sept 24 in Israel (UTC+3 in summer time).
    expect(todayInIsrael(new Date('2026-09-23T22:30:00Z'))).toBe('2026-09-24')
  })
})
