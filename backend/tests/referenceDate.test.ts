import { describe, expect, it } from 'vitest'
import { detectReferenceDate } from '../src/pipeline/referenceDate'

const now = new Date('2026-09-27T09:00:00Z')

describe('detectReferenceDate', () => {
  it('prefers a date the text declares in a heading', () => {
    const text = 'המשימות שלי להיום\nיום רביעי 23.9.2026 אלה הדברים שיש לי לעשות'
    expect(detectReferenceDate(text, '2026-09-30', now)).toEqual({ date: '2026-09-23', origin: 'text' })
  })

  it('ignores a weekday+date that sits inside a sentence', () => {
    const text = 'הקבצים צריכים לצאת לבית הדפוס עד יום שני, 28.9.2026'
    expect(detectReferenceDate(text, null, now).origin).toBe('today')
  })

  it('falls back to the date the user picked', () => {
    expect(detectReferenceDate('משימה', '2026-09-30', now)).toEqual({ date: '2026-09-30', origin: 'user' })
  })

  it('falls back to today in Israel', () => {
    expect(detectReferenceDate('משימה', null, now)).toEqual({ date: '2026-09-27', origin: 'today' })
  })

  it('only looks at the first few lines', () => {
    const text = ['א', 'ב', 'ג', 'ד', 'ה', 'יום רביעי 23.9.2026'].join('\n')
    expect(detectReferenceDate(text, null, now).origin).toBe('today')
  })
})
