import type { Field } from './provenance'

export type BriefFieldKey =
  | 'client'
  | 'campaign'
  | 'message'
  | 'audience'
  | 'tone'
  | 'deadline'
  | 'launchDate'

// A list entry with its own id, so it can be edited or removed. Removal is soft: the entry stays
// (hidden) so pasting the same text again does not bring it back.
export interface BriefItem {
  id: string
  field: Field
  deleted: boolean
}

export type BriefListKey = 'deliverables' | 'constraints' | 'suggestions' | 'missingDetails'

export interface Brief {
  fields: Record<BriefFieldKey, Field>
  deliverables: BriefItem[]
  constraints: BriefItem[]
  // Professional defaults the system suggests. Only the brief may hold `assumed` values.
  suggestions: BriefItem[]
  // Details the work needs and the text does not give; each one becomes a question.
  missingDetails: BriefItem[]
}
