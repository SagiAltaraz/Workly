export type QuestionKind =
  | 'missingField'
  | 'unresolvedValue'
  | 'unverifiedQuote'
  | 'weekdayMismatch'
  | 'awaitingScheduling'
  | 'meetingConflict'
  | 'contradiction'

export type TargetType = 'brief' | 'task' | 'meeting'

export interface Question {
  id: string
  kind: QuestionKind
  text: string
  targetType: TargetType | null
  targetId: string | null
  // The field a question is about (a brief key, dueDate, startTime…), when it is about one.
  field: string | null
  candidates: { existing: string; incoming: string } | null
}
