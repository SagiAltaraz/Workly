import { randomUUID } from 'node:crypto'
import { ValidationError } from '../../errors'
import type { Task } from '../../types/task'
import type { Workspace } from '../../types/workspace'
import { todayInIsrael } from '../dateMath'
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
    },
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
}

export function patchTask(workspace: Workspace, taskId: string, patch: TaskPatch): Change {
  const original = requireTask(workspace, taskId)
  let task = original
  let next = workspace
  const parts: string[] = []
  const settled: string[] = []

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
