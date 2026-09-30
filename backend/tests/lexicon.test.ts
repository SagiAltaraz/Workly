import { describe, expect, it } from 'vitest'
import { dayPartOf, editDistance, correctDateWords, describeCorrections } from '../src/pipeline/hebrewLexicon'
import { parseDate, findWeekday } from '../src/pipeline/parseDate'
import { findTimes, parseTimeRange } from '../src/pipeline/parseTime'
import { parseRelativeMoment } from '../src/pipeline/relativeTime'

const ref = '2026-09-23' // a Wednesday
const first = (text: string) => findTimes(text)[0]?.time ?? null

describe('spelling slips in date words', () => {
  it('reads a slip of one letter and says what it read', () => {
    expect(parseDate('מחרר', ref)).toMatchObject({ date: '2026-09-24', kind: 'inferred', corrections: [{ from: 'מחרר', to: 'מחר' }] })
    expect(parseDate('יום חמשי', ref)).toMatchObject({ date: '2026-09-24', kind: 'inferred' })
    expect(findWeekday('ביום חמשי')).toBe(4)
    expect(describeCorrections(parseDate('מחרר', ref)!.corrections)).toContain('"מחרר" ← "מחר"')
  })

  it('does not turn real words into other words', () => {
    // "ביום" is "on the day", not a typo of "היום"
    expect(parseDate('ביום שני', ref)).toMatchObject({ date: '2026-09-28', corrections: [] })
    expect(correctDateWords('ביום שלישי בבוקר').corrections).toEqual([])
    expect(correctDateWords('שלום').corrections).toEqual([])
    expect(parseDate('לפני שנה', ref)).toBeNull()
  })

  it('keeps a correct word exactly as it is', () => {
    expect(parseDate('מחר', ref)).toMatchObject({ date: '2026-09-24', corrections: [] })
    expect(parseDate('מחרתיים', ref)).toMatchObject({ date: '2026-09-25', corrections: [] })
    expect(parseDate('למחר', ref)?.date).toBe('2026-09-24')
  })

  it('edit distance counts one slip as one', () => {
    expect(editDistance('מחרר', 'מחר')).toBe(1)
    expect(editDistance('חמשי', 'חמישי')).toBe(1)
    expect(editDistance('שני', 'שלישי')).toBeGreaterThan(1)
  })
})

describe('hours written as words', () => {
  it('reads number words', () => {
    expect(first('שמונה וחצי בערב')).toBe('20:30')
    expect(first('בשעה שמונה')).toBe('08:00')
    expect(first('בעשר וחצי')).toBe('10:30')
    expect(first('בשלוש בצהריים')).toBe('15:00')
    expect(first('אחת עשרה בלילה')).toBe('23:00')
    expect(first('שתים עשרה בלילה')).toBe('00:00')
  })

  it('reads minutes before an hour', () => {
    expect(first('רבע לשמונה')).toBe('07:45')
    expect(first('רבע לשמונה בערב')).toBe('19:45')
    expect(first('עשרה ל-9')).toBe('08:50')
    expect(first('עשרים לאחת')).toBe('12:40')
  })

  it('reads a ten-minute or five-minute past', () => {
    expect(first('8 ועשרה בערב')).toBe('20:10')
    expect(first('בשעה 9 וחמש')).toBe('09:05')
  })

  it('reads "until noon" as twelve, even when noon is misspelled', () => {
    expect(first('עד הצהריים')).toBe('12:00')
    expect(first('עד הצהרים')).toBe('12:00')
    expect(first('עד צהריים')).toBe('12:00')
  })

  it('settles a half of the day after an explicit hour', () => {
    expect(first('8:30 בערב')).toBe('20:30')
    expect(first('20:00 בערב')).toBe('20:00')
  })

  it('reads a misspelled part of the day after an hour', () => {
    expect(first('2 בצהרים')).toBe('14:00')
  })

  it('does not read a number word that is not an hour', () => {
    expect(findTimes('שלושה שלטים בכניסה')).toEqual([])
    expect(findTimes('עשר פגישות בחודש')).toEqual([])
    expect(findTimes('חמש משימות להיום')).toEqual([])
  })

  it('still keeps to the old rules', () => {
    expect(parseTimeRange('מ־09:30 עד 10:00').end?.time).toBe('10:00')
    expect(first('ב-9')).toBe('09:00')
  })
})

describe('a part of the day without an hour', () => {
  it('is a window, not a clock time', () => {
    expect(findTimes('אחה"צ')).toEqual([])
    expect(findTimes('בבוקר')).toEqual([])
    expect(dayPartOf('אחה"צ')).toBe('afternoon')
    expect(dayPartOf('אחר הצהריים')).toBe('afternoon')
    expect(dayPartOf('בבוקר')).toBe('morning')
    expect(dayPartOf('בצהריים')).toBe('noon')
    expect(dayPartOf('בצהרים')).toBe('noon')
    expect(dayPartOf('בערב')).toBe('evening')
    expect(dayPartOf('בלילה')).toBe('night')
    expect(dayPartOf('11:00')).toBeNull()
  })
})

describe('a moment counted from now', () => {
  // 10:00 in Israel (UTC+3 in summer time)
  const now = new Date('2026-09-28T07:00:00Z')

  it('adds the wait to the real clock in Israel', () => {
    expect(parseRelativeMoment('עוד שעה', now)).toEqual({ date: '2026-09-28', time: '11:00' })
    expect(parseRelativeMoment('בעוד שעה', now)).toEqual({ date: '2026-09-28', time: '11:00' })
    expect(parseRelativeMoment('עוד שעתיים', now)).toEqual({ date: '2026-09-28', time: '12:00' })
    expect(parseRelativeMoment('עוד חצי שעה', now)).toEqual({ date: '2026-09-28', time: '10:30' })
    expect(parseRelativeMoment('עוד שעה וחצי', now)).toEqual({ date: '2026-09-28', time: '11:30' })
    expect(parseRelativeMoment('עוד רבע שעה', now)).toEqual({ date: '2026-09-28', time: '10:15' })
    expect(parseRelativeMoment('עוד 20 דקות', now)).toEqual({ date: '2026-09-28', time: '10:20' })
    expect(parseRelativeMoment('עוד שלוש שעות', now)).toEqual({ date: '2026-09-28', time: '13:00' })
  })

  it('moves to the next day when the wait crosses midnight', () => {
    const lateNight = new Date('2026-09-28T20:30:00Z') // 23:30 in Israel
    expect(parseRelativeMoment('עוד שעה', lateNight)).toEqual({ date: '2026-09-29', time: '00:30' })
  })

  it('answers nothing when there is no wait in the text', () => {
    expect(parseRelativeMoment('ב-9 בבוקר', now)).toBeNull()
    expect(parseRelativeMoment('עוד מעט', now)).toBeNull()
  })
})
