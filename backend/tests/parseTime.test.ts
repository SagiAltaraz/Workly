import { describe, expect, it } from 'vitest'
import { findTimes, parseTimeRange } from '../src/pipeline/parseTime'

const first = (text: string) => findTimes(text)[0]?.time ?? null

describe('parseTime — Hebrew colloquial forms', () => {
  it('reads a bare hour after "בשעה"', () => {
    expect(first('נפגשים בשעה 9')).toBe('09:00')
  })

  it('reads an hour a meeting was moved to', () => {
    expect(first('הפגישה עברה לשעה 11')).toBe('11:00')
    expect(first('הפגישה עברה ל-11:00')).toBe('11:00')
  })

  it('reads half and quarter hour words', () => {
    expect(first('בשעה 8 וחצי')).toBe('08:30')
    expect(first('בשעה 8 ורבע')).toBe('08:15')
  })

  it('reads an hour with a part of the day', () => {
    expect(first('9 בבוקר')).toBe('09:00')
    expect(first('ב-9 בבוקר')).toBe('09:00')
    expect(first('נפגשים ב־9 בבוקר')).toBe('09:00')
  })

  it('pushes evening and night hours into 24h', () => {
    expect(first('8 בערב')).toBe('20:00')
    expect(first('בשעה 8 בערב')).toBe('20:00')
    expect(first('9 בלילה')).toBe('21:00')
    expect(first('12 בלילה')).toBe('00:00')
    expect(first('2 בצהריים')).toBe('14:00')
    expect(first('4 אחה"צ')).toBe('16:00')
  })

  it('reads half hour before a part of the day', () => {
    expect(first('8 וחצי בערב')).toBe('20:30')
  })

  it('reads a bare "ב-9" using the leading ב as the only signal', () => {
    expect(first('נפגשים ב-9')).toBe('09:00')
    expect(first('נפגשים ב-9.')).toBe('09:00')
  })

  it('lets an explicit HH:MM win over every fallback', () => {
    expect(first('ב-9 בבוקר, ליתר דיוק ב־10:15')).toBe('09:00')
    expect(findTimes('ב־10:15')).toEqual([{ time: '10:15', kind: 'explicit' }])
    expect(first('בשעה 10:45')).toBe('10:45')
  })

  it('marks explicit and worded times differently', () => {
    expect(findTimes('10:00')[0].kind).toBe('explicit')
    expect(findTimes('בשעה 9')[0].kind).toBe('inferred')
  })

  it('never reads an unrelated number as a time', () => {
    expect(findTimes('צריך להכין 3 שלטים')).toEqual([])
    expect(findTimes('השלט הגדול הוא 8 על 3 מטר')).toEqual([])
    expect(findTimes('הקבצים יוצאים ב-5.10')).toEqual([])
    expect(findTimes('עד יום שני, 28.9.2026')).toEqual([])
    expect(findTimes('בשעות הפעילות של הרשת')).toEqual([])
    expect(findTimes('מחיר 250 ש"ח')).toEqual([])
  })

  it('rejects impossible clock values', () => {
    expect(findTimes('25:70')).toEqual([])
    expect(findTimes('ב-25')).toEqual([])
  })
})

describe('parseTimeRange', () => {
  it('reads a written range', () => {
    const range = parseTimeRange('מ־09:30 עד 10:00')
    expect(range.start?.time).toBe('09:30')
    expect(range.end?.time).toBe('10:00')
  })

  it('reads a single deadline time', () => {
    const range = parseTimeRange('עד 11:00')
    expect(range.start?.time).toBe('11:00')
    expect(range.end).toBeNull()
  })

  it('returns nothing when there is no time', () => {
    expect(parseTimeRange('עד סוף היום')).toEqual({ start: null, end: null })
  })
})
