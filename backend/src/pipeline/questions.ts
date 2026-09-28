import { hebrewWeekdays, weekdayOf } from './dateMath'
import { briefFieldLabels, requiredBriefFields } from './labels'
import type { Brief, BriefItem } from '../types/brief'
import type { Field } from '../types/provenance'
import type { Question, QuestionKind, TargetType } from '../types/question'
import type { Workspace } from '../types/workspace'
import { labelOfTarget } from './labels'

function question(
  kind: QuestionKind,
  text: string,
  targetType: TargetType | null,
  targetId: string | null,
  key: string,
): Question {
  return {
    id: `${kind}:${targetType ?? '-'}:${targetId ?? '-'}:${key}`,
    kind,
    text,
    targetType,
    targetId,
    field: key,
    candidates: null,
  }
}

const problemFieldLabels: Record<string, string> = {
  quote: 'הציטוט',
  dueDate: 'תאריך יעד',
  dueTime: 'שעת יעד',
  date: 'תאריך',
  startTime: 'שעת התחלה',
}

function fieldProblem(
  field: Field,
  label: string,
  targetType: TargetType,
  targetId: string | null,
  key: string,
): Question | null {
  const fieldLabel = problemFieldLabels[key]
  const where = fieldLabel ? `${label} (${fieldLabel})` : label
  if (field.status === 'missing' && field.note !== null) {
    return question('unresolvedValue', `${where}: ${field.note}. מה הערך הנכון?`, targetType, targetId, key)
  }
  const claimsFact = field.status === 'stated' || field.status === 'inferred'
  if (claimsFact && field.value !== null && !field.verified && !field.editedByUser) {
    return question(
      'unverifiedQuote',
      `${where}: לא הצלחתי לאמת את "${field.value}" מול הטקסט המקורי. כדאי לבדוק ידנית.`,
      targetType,
      targetId,
      key,
    )
  }
  return null
}

function briefQuestions(brief: Brief): Question[] {
  const found: Question[] = []
  for (const key of requiredBriefFields) {
    if (brief.fields[key].value === null && brief.fields[key].note === null) {
      found.push(
        question('missingField', `בבריף לא צוין: ${briefFieldLabels[key]}. מה הערך?`, 'brief', null, key),
      )
    }
  }
  const live = (items: BriefItem[]) => items.filter((item) => !item.deleted)
  if (live(brief.deliverables).length === 0) {
    found.push(question('missingField', 'בבריף לא צוינו תוצרים להכנה. מה צריך להכין?', 'brief', null, 'deliverables'))
  }
  for (const detail of live(brief.missingDetails)) {
    found.push(question('missingField', `חסר בבריף: ${detail.field.value}`, 'brief', null, `missingDetail:${detail.id}`))
  }

  const entries: [string, Field][] = [
    ...(Object.entries(brief.fields) as [keyof typeof briefFieldLabels, Field][]).map(
      ([key, field]) => [key, field] as [string, Field],
    ),
    ...live(brief.deliverables).map((item) => [`deliverable:${item.id}`, item.field] as [string, Field]),
    ...live(brief.constraints).map((item) => [`constraint:${item.id}`, item.field] as [string, Field]),
  ]
  for (const [key, field] of entries) {
    const label = key in briefFieldLabels ? briefFieldLabels[key as keyof typeof briefFieldLabels] : 'בבריף'
    const problem = fieldProblem(field, label, 'brief', null, key)
    if (problem) found.push(problem)
  }
  return found
}

function actualWeekday(date: string): string {
  return `יום ${hebrewWeekdays[weekdayOf(date)]}`
}

export function deriveQuestions(workspace: Workspace): Question[] {
  const found: Question[] = []

  if (workspace.brief) found.push(...briefQuestions(workspace.brief))

  for (const task of workspace.tasks.filter((item) => !item.deleted)) {
    const label = `משימה "${task.title}"`
    for (const [key, field] of [
      ['quote', task.quote],
      ['dueDate', task.dueDate],
      ['dueTime', task.dueTime],
    ] as const) {
      const problem = fieldProblem(field, label, 'task', task.id, key)
      if (problem) found.push(problem)
    }
  }

  const liveMeetings = workspace.meetings.filter((item) => !item.deleted)
  const byId = new Map(liveMeetings.map((meeting) => [meeting.id, meeting]))
  for (const meeting of liveMeetings) {
    const label = `פגישה "${meeting.topic}"`
    for (const [key, field] of [
      ['quote', meeting.quote],
      ['date', meeting.date],
      ['startTime', meeting.startTime],
    ] as const) {
      const problem = fieldProblem(field, label, 'meeting', meeting.id, key)
      if (problem) found.push(problem)
    }

    if (meeting.weekdayMismatch && meeting.date.value && meeting.weekdayWritten) {
      found.push(
        question(
          'weekdayMismatch',
          `${label}: בטקסט כתוב "${meeting.weekdayWritten}", אבל ${meeting.date.value} הוא ${actualWeekday(meeting.date.value)}. איזה מהם נכון?`,
          'meeting',
          meeting.id,
          'weekday',
        ),
      )
    }

    if (meeting.awaitingScheduling) {
      found.push(
        question('awaitingScheduling', `${label} עדיין בלי מועד מתואם. מתי היא מתקיימת?`, 'meeting', meeting.id, 'schedule'),
      )
    }

    for (const otherId of meeting.conflictsWith) {
      const other = byId.get(otherId)
      if (!other || meeting.id > otherId) continue
      found.push(
        question(
          'meetingConflict',
          `${label} חופפת בזמן ל"${other.topic}" ב-${meeting.date.value}.`,
          'meeting',
          meeting.id,
          otherId,
        ),
      )
    }
  }

  for (const contradiction of workspace.contradictions) {
    const { target } = contradiction
    const owner =
      target.type === 'task'
        ? `משימה "${workspace.tasks.find((task) => task.id === target.id)?.title ?? ''}"`
        : target.type === 'meeting'
          ? `פגישה "${workspace.meetings.find((meeting) => meeting.id === target.id)?.topic ?? ''}"`
          : 'הבריף'
    const label = labelOfTarget(target)
    found.push({
      id: contradiction.id,
      kind: 'contradiction',
      text: `${owner} (${label}): נמצאו שני ערכים שונים בטקסטים שונים. איזה נכון?`,
      targetType: contradiction.target.type,
      targetId: contradiction.target.type === 'brief' ? null : contradiction.target.id,
      field: contradiction.target.key,
      candidates: {
        existing: contradiction.existing.value ?? '',
        incoming: contradiction.incoming.value ?? '',
      },
    })
  }

  return found.filter((item) => !workspace.dismissedQuestionIds.includes(item.id))
}
