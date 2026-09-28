import { addDays } from './dateMath'
import type { Bucket, PriorityRule, PriorityTier, Task } from '../types/task'

const ruleTier: Record<PriorityRule, PriorityTier | null> = {
  blocked: null,
  p1Critical: 'p1',
  p3CanSlip: 'p3',
  p2Today: 'p2',
  p4Later: 'p4',
}

function isDueToday(task: Task, referenceDate: string): boolean {
  if (task.dueDate.value !== null) return task.dueDate.value === referenceDate
  return task.signals.listedUnder === 'today'
}

function bucketOf(task: Task, referenceDate: string, dueToday: boolean): Bucket {
  if (task.signals.canWait === 'laterThisWeek') return 'week'
  if (dueToday) return 'today'
  const due = task.dueDate.value
  if (due !== null) {
    return due > referenceDate && due <= addDays(referenceDate, 7) ? 'week' : 'later'
  }
  return task.signals.listedUnder === 'week' ? 'week' : 'later'
}

function p1Reasons(task: Task): string[] {
  const reasons: string[] = []
  if (task.signals.urgency) reasons.push('מסומן כדחוף בטקסט')
  if (task.signals.externalWaiting) reasons.push('מישהו מחכה לתשובה')
  if (task.signals.blocksOthers) reasons.push('חוסם משימות אחרות')
  return reasons
}

interface RuleResult {
  rule: PriorityRule
  reason: string
}

// Evaluated in order, first match wins. The matched rule is kept so the UI can explain it.
function matchRule(task: Task, referenceDate: string, dueToday: boolean): RuleResult {
  const { signals } = task
  const hardTime = task.dueTime.value

  if (signals.condition) {
    return { rule: 'blocked', reason: `חסומה עד שיתקיים התנאי: "${signals.condition}"` }
  }

  const p1 = p1Reasons(task)
  if (dueToday && hardTime !== null && p1.length > 0) {
    return { rule: 'p1Critical', reason: `יעד היום עד ${hardTime}, ${p1.join(', ')}` }
  }

  if (signals.canWait === 'tomorrow') {
    return { rule: 'p3CanSlip', reason: 'בטקסט כתוב שאפשר לדחות למחר' }
  }

  // A task the text calls "not urgent" is not P2 even when it sits under "today".
  if (dueToday && !signals.notUrgent) {
    return {
      rule: 'p2Today',
      reason: hardTime !== null ? `יעד היום עד ${hardTime}` : 'יעד היום, בלי שעה קשיחה',
    }
  }

  if (signals.notUrgent) return { rule: 'p4Later', reason: 'מסומן בטקסט כלא דחוף' }
  const due = task.dueDate.value
  if (due !== null && due > referenceDate) return { rule: 'p4Later', reason: `יעד ב-${due}, אחרי היום` }
  return { rule: 'p4Later', reason: 'אין מועד קרוב' }
}

export function prioritizeTask(task: Task, referenceDate: string): Task {
  const dueToday = isDueToday(task, referenceDate)
  const { rule, reason } = matchRule(task, referenceDate, dueToday)
  return {
    ...task,
    blocked: rule === 'blocked',
    bucket: bucketOf(task, referenceDate, dueToday),
    priority: ruleTier[rule],
    rule,
    reason,
  }
}

export function prioritizeTasks(tasks: Task[], referenceDate: string): Task[] {
  return tasks.map((task) => prioritizeTask(task, referenceDate))
}
