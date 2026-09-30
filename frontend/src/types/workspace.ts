import type { Brief, BriefFieldKey } from './brief'
import type { Field } from './provenance'
import type { Meeting } from './meeting'
import type { Question } from './question'
import type { Task } from './task'

export type ReferenceDateOrigin = 'text' | 'user' | 'today'

export interface SourceInput {
  id: string
  // Normalized text. Every span in the workspace points into this exact string.
  text: string
  addedAt: string
  referenceDate: string
  referenceDateOrigin: ReferenceDateOrigin
}

// The one place a field can be addressed from outside (edits, contradiction answers).
export type FieldTarget =
  | { type: 'brief'; briefId: string; key: BriefFieldKey }
  | { type: 'task'; id: string; key: 'dueDate' | 'dueTime' }
  | { type: 'meeting'; id: string; key: 'date' | 'startTime' | 'endTime' }

export interface Contradiction {
  id: string
  target: FieldTarget
  existing: Field
  incoming: Field
}

// One line of what changed, from a card, from the chat, or from a pasted text.
export interface ActivityEntry {
  id: string
  label: string
  at: string
}

export interface Workspace {
  id: string
  createdAt: string
  updatedAt: string
  referenceDate: string | null
  referenceDateOrigin: ReferenceDateOrigin | null
  sources: SourceInput[]
  // Every brief pasted in, each its own card. Matched and merged by client/campaign/message.
  briefs: Brief[]
  tasks: Task[]
  meetings: Meeting[]
  contradictions: Contradiction[]
  dismissedQuestionIds: string[]
  // The person's own order of cards that have no hour (task and meeting ids). Cards with an hour
  // stay where their hour puts them.
  cardOrder: string[]
  activity: ActivityEntry[]
  // Derived after every change: gaps, mismatches, conflicts and open contradictions.
  questions: Question[]
}
