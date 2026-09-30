import type { Field } from './provenance'

export type PriorityTier = 'p1' | 'p2' | 'p3' | 'p4'
export type PriorityRule = 'blocked' | 'p1Critical' | 'p3CanSlip' | 'p2Today' | 'p4Later'
// A part of the day the text named without an hour ("מחר אחה"צ"): a window, not a deadline.
export type DayPart = 'morning' | 'noon' | 'afternoon' | 'evening' | 'night'

export type Bucket = 'today' | 'tomorrow' | 'week' | 'later'

// Only signals whose quote code found in the source end up here.
export interface TaskSignals {
  urgency: string | null
  externalWaiting: string | null
  blocksOthers: string | null
  condition: string | null
  canWait: 'tomorrow' | 'laterThisWeek' | null
  notUrgent: string | null
  listedUnder: 'today' | 'week' | null
  dayPart: DayPart | null
}

// A task that only exists because of a meeting ("prepare materials for the meeting with Sagi").
// `phrase` is the words from the text; `meetingId` is filled in by code once exactly one meeting matches.
export interface MeetingLink {
  phrase: string
  meetingId: string | null
}

// When the task really has to be done by. It is the task's own date and time, and where the task has
// none, those of the meeting it is a preparation for.
export interface EffectiveDeadline {
  date: string | null
  time: string | null
  meetingId: string | null
}

export interface Task {
  id: string
  // Display label written by the model; the quote below is the evidence.
  title: string
  quote: Field
  dueDate: Field
  dueTime: Field
  signals: TaskSignals
  meetingLink: MeetingLink | null
  // Computed with the priority: not stored from the text.
  deadline: EffectiveDeadline
  done: boolean
  // Soft delete: hidden everywhere, kept so a later paste of the same text does not revive it.
  deleted: boolean
  blocked: boolean
  bucket: Bucket
  priority: PriorityTier | null
  rule: PriorityRule
  reason: string
}
