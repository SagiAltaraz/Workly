import type { SourceSpan } from '../types/provenance'
import { normalizeText } from './normalize'

export interface QuoteMatch {
  start: number
  end: number
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Verbatim only: the quote must appear in the source, allowing nothing but different
// whitespace (a model often re-wraps a line). Anything looser would let it invent.
export function findQuote(source: string, quote: string): QuoteMatch | null {
  const cleaned = normalizeText(quote)
  if (cleaned.length === 0) return null

  const exact = source.indexOf(cleaned)
  if (exact !== -1) return { start: exact, end: exact + cleaned.length }

  const words = cleaned.split(/\s+/).map(escapeRegExp)
  const flexible = new RegExp(words.join('\\s+')).exec(source)
  if (flexible) return { start: flexible.index, end: flexible.index + flexible[0].length }

  return null
}

export function locateQuote(inputId: string, source: string, quote: string): SourceSpan | null {
  const match = findQuote(source, quote)
  return match ? { inputId, start: match.start, end: match.end } : null
}

function tokens(value: string): Set<string> {
  return new Set(
    value
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter((token) => token.length > 1),
  )
}

// Share of the smaller quote's words that also appear in the other one.
export function quoteOverlap(first: string, second: string): number {
  const a = tokens(first)
  const b = tokens(second)
  if (a.size === 0 || b.size === 0) return 0
  let shared = 0
  for (const token of a) if (b.has(token)) shared += 1
  return shared / Math.min(a.size, b.size)
}
