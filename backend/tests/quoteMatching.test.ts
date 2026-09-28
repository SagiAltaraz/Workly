import { describe, expect, it } from 'vitest'
import { normalizeText } from '../src/pipeline/normalize'
import { findQuote, quoteOverlap } from '../src/pipeline/quoteMatching'

describe('normalizeText', () => {
  it('unifies hebrew punctuation, bullets and invisible marks', () => {
    const raw = '‏• מ־09:30 עד 10:00  “פגישה”\r\nשורה'
    expect(normalizeText(raw)).toBe('- מ-09:30 עד 10:00 "פגישה"\nשורה')
  })
})

describe('findQuote', () => {
  const source = 'הלקוח צריך להכין חומרים\nלהפקת דפוס עד יום שני'

  it('finds an exact quote and returns its offsets', () => {
    const match = findQuote(source, 'להכין חומרים')
    expect(match && source.slice(match.start, match.end)).toBe('להכין חומרים')
  })

  it('tolerates only whitespace differences', () => {
    const match = findQuote(source, 'חומרים להפקת דפוס')
    expect(match && source.slice(match.start, match.end)).toBe('חומרים\nלהפקת דפוס')
  })

  it('rejects a paraphrase', () => {
    expect(findQuote(source, 'הלקוח צריך להכין את החומרים')).toBeNull()
  })

  it('rejects an empty quote', () => {
    expect(findQuote(source, '   ')).toBeNull()
  })
})

describe('quoteOverlap', () => {
  it('is high for the same sentence and low for unrelated ones', () => {
    expect(quoteOverlap('פגישת צוות ב-10:00 עד 10:20', 'יש לי פגישת צוות ב-10:00 עד 10:20')).toBeGreaterThan(0.9)
    expect(quoteOverlap('להתקשר לספק השילוט', 'פגישת צוות בעשר')).toBeLessThan(0.2)
  })
})
