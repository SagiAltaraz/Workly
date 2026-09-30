import { randomUUID } from 'node:crypto'
import { ValidationError } from '../../errors'
import type { Task } from '../../types/task'
import type { Workspace } from '../../types/workspace'
import { addDays, todayInIsrael } from '../dateMath'
import { missingField, userField } from '../fields'
import { recompute } from '../recompute'
import type { Change } from './change'
import { clearedField } from './fieldEdits'
import { dropContradictions, replaceTask, requireTask } from './lookup'
import { assertDate, assertText, assertTime, shownValue } from './validation'

export interface NewTaskInput {
  title: string
  listedUnder: 'today' | 'week'
  dueDate: string | null
  dueTime: string | null
}

// A task typed in by hand: every value is the person's, so nothing about it needs a quote.
export function addTask(workspace: Workspace, input: NewTaskInput): Change {
  const title = assertText(input.title, 'שם המשימה')
  const dueDate = input.dueDate !== null ? assertDate(input.dueDate) : null
  const dueTime = input.dueTime !== null ? assertTime(input.dueTime) : null

  const dateField =
    dueDate !== null
      ? userField(dueDate)
      : input.listedUnder === 'today'
        ? userField(workspace.referenceDate ?? todayInIsrael())
        : missingField()

  const task: Task = {
    id: randomUUID(),
    title,
    quote: userField(title),
    dueDate: dateField,
    dueTime: dueTime !== null ? userField(dueTime) : missingField(),
    signals: {
      urgency: null,
      externalWaiting: null,
      blocksOthers: null,
      condition: null,
      canWait: null,
      notUrgent: null,
      listedUnder: input.listedUnder,
      dayPart: null,
    },
    meetingLink: null,
    deadline: { date: null, time: null, meetingId: null },
    done: false,
    deleted: false,
    blocked: false,
    bucket: 'later',
    priority: null,
    rule: 'p4Later',
    reason: '',
  }
  return { workspace: recompute({ ...workspace, tasks: [...workspace.tasks, task] }), label: `נוספה משימה "${title}"` }
}

// null clears a value; leaving a key out leaves it alone.
export interface TaskPatch {
  title?: string
  done?: boolean
  dueDate?: string | null
  dueTime?: string | null
  conditionResolved?: boolean
  // Moves the task to a column of the board, as if it had been dragged there.
  placement?: Placement
}

export type Placement = 'today' | 'tomorrow' | 'week' | 'later'

const placementNames: Record<Placement, string> = {
  today: 'היום',
  tomorrow: 'מחר',
  week: 'השבוע הקרוב',
  later: 'בהמשך',
}

// Today and tomorrow are real dates. "This week" is a place without a day: the date is cleared and the
// task is listed under the week. The person's move overrides what the text said about waiting.
function placed(task: Task, placement: Placement, referenceDate: string): Task {
  const date =
    placement === 'today' ? referenceDate : placement === 'tomorrow' ? addDays(referenceDate, 1) : null
  return {
    ...task,
    dueDate: date === null ? clearedField() : userField(date),
    signals: { ...task.signals, canWait: null, listedUnder: placement === 'week' ? 'week' : null },
  }
}

export function patchTask(workspace: Workspace, taskId: string, patch: TaskPatch): Change {
  const original = requireTask(workspace, taskId)
  let task = original
  let next = workspace
  const parts: string[] = []
  const settled: string[] = []

  if (patch.placement !== undefined) {
    task = placed(task, patch.placement, workspace.referenceDate ?? todayInIsrael())
    parts.push(`הועברה אל ${placementNames[patch.placement]}`)
    settled.push('dueDate')
  }
  if (patch.title !== undefined) {
    task = { ...task, title: assertText(patch.title, 'שם המשימה') }
    parts.push(`שם ← "${task.title}"`)
  }
  if (patch.dueDate !== undefined) {
    const value = patch.dueDate === null ? null : assertDate(patch.dueDate)
    task = { ...task, dueDate: value === null ? clearedField() : userField(value) }
    parts.push(`תאריך יעד: ${shownValue(original.dueDate.value)} ← ${shownValue(value)}`)
    settled.push('dueDate')
  }
  if (patch.dueTime !== undefined) {
    const value = patch.dueTime === null ? null : assertTime(patch.dueTime)
    task = { ...task, dueTime: value === null ? clearedField() : userField(value) }
    parts.push(`שעת יעד: ${shownValue(original.dueTime.value)} ← ${shownValue(value)}`)
    settled.push('dueTime')
  }
  if (patch.conditionResolved) {
    if (!task.signals.condition) throw new ValidationError('המשימה לא חסומה')
    task = { ...task, signals: { ...task.signals, condition: null } }
    parts.push('התנאי סומן כהתקיים, המשימה שוחררה')
  }
  if (patch.done !== undefined) {
    task = { ...task, done: patch.done }
    parts.push(patch.done ? 'סומנה כבוצעה' : 'סומנה כלא בוצעה')
  }
  if (parts.length === 0) throw new ValidationError('אין מה לעדכן')

  next = replaceTask(next, task)
  if (settled.length > 0) next = dropContradictions(next, 'task', taskId, settled)
  return { workspace: recompute(next), label: `משימה "${task.title}": ${parts.join(', ')}` }
}

export function deleteTask(workspace: Workspace, taskId: string): Change {
  const task = requireTask(workspace, taskId)
  return {
    workspace: recompute(replaceTask(workspace, { ...task, deleted: true })),
    label: `נמחקה משימה "${task.title}"`,
  }
}

export function restoreTask(workspace: Workspace, taskId: string): Change {
  const task = requireTask(workspace, taskId)
  return {
    workspace: recompute(replaceTask(workspace, { ...task, deleted: false })),
    label: `שוחזרה משימה "${task.title}"`,
  }
}
