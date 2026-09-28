import type { BriefFieldKey } from '../types/brief'
import type { FieldTarget } from '../types/workspace'

export const briefFieldLabels: Record<BriefFieldKey, string> = {
  client: 'לקוח',
  campaign: 'קמפיין',
  message: 'מסר',
  audience: 'קהל יעד',
  tone: 'טון',
  deadline: 'מועד הגשה',
  launchDate: 'עליית הקמפיין',
}

export const requiredBriefFields: BriefFieldKey[] = ['client', 'campaign', 'deadline']

export const taskFieldLabels = { dueDate: 'תאריך יעד', dueTime: 'שעת יעד' } as const

export const meetingFieldLabels = {
  date: 'תאריך',
  startTime: 'שעת התחלה',
  endTime: 'שעת סיום',
} as const

export function labelOfTarget(target: FieldTarget): string {
  if (target.type === 'brief') return briefFieldLabels[target.key]
  if (target.type === 'task') return taskFieldLabels[target.key]
  return meetingFieldLabels[target.key]
}
