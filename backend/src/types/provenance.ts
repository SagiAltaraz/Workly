export type FactStatus = 'stated' | 'inferred' | 'assumed' | 'missing'

export interface SourceSpan {
  inputId: string
  start: number
  end: number
}

// A value shown on screen. It only counts as a fact once code found its quote in the source.
export interface Field<T = string> {
  value: T | null
  status: FactStatus
  quote: string | null
  span: SourceSpan | null
  verified: boolean
  editedByUser: boolean
  // In Hebrew, for the UI: why a value is missing or unresolved (which becomes a question), or how an
  // inferred value was read (for instance a spelling slip that was corrected).
  note: string | null
}
