import type { Field, FactStatus, SourceSpan } from '../types/provenance'
import { findQuote, locateQuote } from './quoteMatching'
import { normalizeText } from './normalize'

export interface SourceContext {
  inputId: string
  text: string
}

export function missingField(note: string | null = null): Field {
  return { value: null, status: 'missing', quote: null, span: null, verified: false, editedByUser: false, note }
}

export function assumedField(value: string): Field {
  return { value, status: 'assumed', quote: null, span: null, verified: false, editedByUser: false, note: null }
}

export function userField(value: string): Field {
  return { value, status: 'stated', quote: null, span: null, verified: true, editedByUser: true, note: null }
}

interface SourcedInput {
  value: string
  status: Extract<FactStatus, 'stated' | 'inferred'>
  quote: string
  evidenceText: string
}

// A value is only verified when code found its quote in the source AND the words it was
// read from inside that quote. The model's claim alone never makes a fact.
export function sourcedField(context: SourceContext, input: SourcedInput): Field {
  const quote = normalizeText(input.quote)
  const span: SourceSpan | null = locateQuote(context.inputId, context.text, quote)
  const evidenceInQuote = findQuote(quote, input.evidenceText) !== null
  return {
    value: input.value,
    status: input.status,
    quote,
    span,
    verified: span !== null && evidenceInQuote,
    editedByUser: false,
    note: null,
  }
}

export function appearsInSource(context: SourceContext, text: string): boolean {
  return findQuote(context.text, text) !== null
}
