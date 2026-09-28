import type { Field } from './provenance'

export interface Meeting {
  id: string
  topic: string
  quote: Field
  weekdayWritten: string | null
  date: Field
  startTime: Field
  endTime: Field
  participants: string[]
  deleted: boolean
  awaitingScheduling: boolean
  weekdayMismatch: boolean
  conflictsWith: string[]
}
