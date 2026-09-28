import type { Field } from './provenance'

export type PriorityTier = 'p1' | 'p2' | 'p3' | 'p4'
export type PriorityRule = 'blocked' | 'p1Critical' | 'p3CanSlip' | 'p2Today' | 'p4Later'
export type Bucket = 'today' | 'week' | 'later'

// Only signals whose quote code found in the source end up here.
export interface TaskSignals {
  urgency: string | null
  externalWaiting: string | null
  blocksOthers: string | null
  condition: string | null
  canWait: 'tomorrow' | 'laterThisWeek' | null
  notUrgent: string | null
  listedUnder: 'today' | 'week' | null
}

export interface Task {
  id: string
  // Display label written by the model; the quote below is the evidence.
  title: string
  quote: Field
  dueDate: Field
  dueTime: Field
  signals: TaskSignals
  done: boolean
  // Soft delete: hidden everywhere, kept so a later paste of the same text does not revive it.
  deleted: boolean
  blocked: boolean
  bucket: Bucket
  priority: PriorityTier | null
  rule: PriorityRule
  reason: string
}
