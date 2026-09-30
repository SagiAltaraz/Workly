import type { Field } from './provenance'
import type { DayPart } from './task'

export interface Meeting {
  id: string
  topic: string
  quote: Field
  weekdayWritten: string | null
  date: Field
  startTime: Field
  endTime: Field
  participants: string[]
  dayPart: DayPart | null
  deleted: boolean
  awaitingScheduling: boolean
  weekdayMismatch: boolean
  conflictsWith: string[]
}
