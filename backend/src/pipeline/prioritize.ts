import { addDays } from './dateMath'
import type { Meeting } from '../types/meeting'
import type { Bucket, EffectiveDeadline, PriorityRule, PriorityTier, Task } from '../types/task'

const ruleTier: Record<PriorityRule, PriorityTier | null> = {
  blocked: null,
  p1Critical: 'p1',
  p3CanSlip: 'p3',
  p2Today: 'p2',
  p4Later: 'p4',
}

// The task's own date and time; where it has none, those of the meeting it is a preparation for.
// A meeting's start only becomes the task's hour when both fall on the same day.
function deadlineOf(task: Task, meeting: Meeting | null): EffectiveDeadline {
  const ownDate = task.dueDate.value
  const ownTime = task.dueTime.value
  if (!meeting || !meeting.date.value) return { date: ownDate, time: ownTime, meetingId: null }

  const date = ownDate ?? meeting.date.value
  const time = ownTime ?? (date === meeting.date.value ? meeting.startTime.value : null)
  return { date, time, meetingId: meeting.id }
}

function isDueToday(task: Task, deadline: EffectiveDeadline, referenceDate: string): boolean {
  if (deadline.date !== null) return deadline.date === referenceDate
  return task.signals.listedUnder === 'today'
}

function bucketOf(task: Task, deadline: EffectiveDeadline, referenceDate: string, dueToday: boolean): Bucket {
  if (task.signals.canWait === 'laterThisWeek') return 'week'
  if (dueToday) return 'today'
  const due = deadline.date
  if (due !== null) {
    if (due === addDays(referenceDate, 1)) return 'tomorrow'
    return due > referenceDate && due <= addDays(referenceDate, 7) ? 'week' : 'later'
  }
  return task.signals.listedUnder === 'week' ? 'week' : 'later'
}

// "Urgent", "the most important", "critical": words that ask for it now. A plain "important" does not.
const strongUrgency = /(?<!\p{Script=Hebrew})(דחוף|דחופה|הכי חשוב|חשוב מאוד|קריטי|בהול|מיידי|חובה|לא לדחות)(?!\p{Script=Hebrew})/u

export function isStrongUrgency(task: Task): boolean {
  return task.signals.urgency !== null && task.signals.notUrgent === null && strongUrgency.test(task.signals.urgency)
}

function p1Reasons(task: Task): string[] {
  const reasons: string[] = []
  if (task.signals.urgency) reasons.push(isStrongUrgency(task) ? 'סומן כדחוף מאוד בטקסט' : 'מסומן כדחוף בטקסט')
  if (task.signals.externalWaiting) reasons.push('מישהו מחכה לתשובה')
  if (task.signals.blocksOthers) reasons.push('חוסם משימות אחרות')
  return reasons
}

interface RuleResult {
  rule: PriorityRule
  reason: string
}

interface RuleInput {
  task: Task
  deadline: EffectiveDeadline
  meeting: Meeting | null
  referenceDate: string
  dueToday: boolean
}

// "until 20:00", and where the hour comes from the meeting, which meeting.
function deadlineParts(input: RuleInput): string[] {
  const { task, deadline, meeting } = input
  const parts = [deadline.time !== null ? `יעד היום עד ${deadline.time}` : 'יעד היום, בלי שעה קשיחה']
  const hourFromMeeting = meeting !== null && task.dueTime.value === null && deadline.time !== null
  if (hourFromMeeting) parts[0] = `יעד היום עד ${deadline.time}`
  if (meeting !== null && deadline.time !== null) parts.push(`הכנה לפני הפגישה "${meeting.topic}"`)
  return parts
}

// Evaluated in order, first match wins. The matched rule is kept so the UI can explain it.
function matchRule(input: RuleInput): RuleResult {
  const { task, deadline, referenceDate, dueToday } = input
  const { signals } = task
  const hardTime = deadline.time

  if (signals.condition) {
    return { rule: 'blocked', reason: `חסומה עד שיתקיים התנאי: "${signals.condition}"` }
  }

  // Strong urgency is critical today even without an hour; anything softer also needs a hard time.
  const p1 = p1Reasons(task)
  if (dueToday && (isStrongUrgency(task) || (hardTime !== null && p1.length > 0))) {
    return { rule: 'p1Critical', reason: [...deadlineParts(input), ...p1].join(', ') }
  }

  if (signals.canWait === 'tomorrow') {
    return { rule: 'p3CanSlip', reason: 'בטקסט כתוב שאפשר לדחות למחר' }
  }

  // A task the text calls "not urgent" is not P2 even when it sits under "today".
  if (dueToday && !signals.notUrgent) {
    return { rule: 'p2Today', reason: deadlineParts(input).join(', ') }
  }

  if (signals.notUrgent) return { rule: 'p4Later', reason: 'מסומן בטקסט כלא דחוף' }
  const due = deadline.date
  if (due !== null && due > referenceDate) return { rule: 'p4Later', reason: `יעד ב-${due}, אחרי היום` }
  return { rule: 'p4Later', reason: 'אין מועד קרוב' }
}

export function prioritizeTask(task: Task, referenceDate: string, meetings: Meeting[] = []): Task {
  const linkedId = task.meetingLink?.meetingId ?? null
  const meeting = linkedId ? (meetings.find((item) => item.id === linkedId && !item.deleted) ?? null) : null
  const deadline = deadlineOf(task, meeting)
  const dueToday = isDueToday(task, deadline, referenceDate)
  const { rule, reason } = matchRule({ task, deadline, meeting, referenceDate, dueToday })
  return {
    ...task,
    deadline,
    blocked: rule === 'blocked',
    bucket: bucketOf(task, deadline, referenceDate, dueToday),
    priority: ruleTier[rule],
    rule,
    reason,
  }
}

export function prioritizeTasks(tasks: Task[], referenceDate: string, meetings: Meeting[] = []): Task[] {
  return tasks.map((task) => prioritizeTask(task, referenceDate, meetings))
}
