import type { SourceSpan } from '../types/provenance'

export interface SplitSource {
  before: string
  match: string
  after: string
}

export function splitAroundSpan(text: string, span: SourceSpan): SplitSource {
  return {
    before: text.slice(0, span.start),
    match: text.slice(span.start, span.end),
    after: text.slice(span.end),
  }
}
