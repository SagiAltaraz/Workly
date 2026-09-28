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
  // Why a value is missing or unresolved, in Hebrew, for the UI.
  note: string | null
}
