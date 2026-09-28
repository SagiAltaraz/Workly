import type { Meeting } from '../types/meeting'
import type { Task } from '../types/task'
import type { Workspace } from '../types/workspace'
import { addDays, todayInIsrael } from './isoDate'

export type ColumnId = 'today' | 'week' | 'blocked' | 'done' | 'later'

export type BoardCard =
  | { kind: 'task'; task: Task }
  | { kind: 'meeting'; meeting: Meeting }

const taskRank = { p1: 1, p2: 2, p3: 3, p4: 4 } as const
// A fixed meeting is a commitment that must happen, so without a computed tier it ranks like the
// most important tasks. Otherwise "all tasks, then all meetings" would win by accident.
const meetingRank = 1
const blockedRank = 5

export function rankOf(card: BoardCard): number {
  if (card.kind === 'meeting') return meetingRank
  return card.task.priority ? taskRank[card.task.priority] : blockedRank
}

// A task listed under "today" has no date of its own, but it sorts as today, not as undated.
function dateOf(card: BoardCard, referenceDate: string): string {
  const value = card.kind === 'task' ? card.task.dueDate.value : card.meeting.date.value
  if (value) return value
  return card.kind === 'task' && card.task.bucket === 'today' ? referenceDate : '9999-99-99'
}

function timeOf(card: BoardCard): string {
  const value = card.kind === 'task' ? card.task.dueTime.value : card.meeting.startTime.value
  return value ?? '99:99'
}

function titleOf(card: BoardCard): string {
  return card.kind === 'task' ? card.task.title : card.meeting.topic
}

// Priority rank first, then by day and time inside the same rank (the day keeps a column that
// spans several days in true order).
export function sortCards(cards: BoardCard[], referenceDate: string): BoardCard[] {
  return [...cards].sort(
    (a, b) =>
      rankOf(a) - rankOf(b) ||
      dateOf(a, referenceDate).localeCompare(dateOf(b, referenceDate)) ||
      timeOf(a).localeCompare(timeOf(b)) ||
      titleOf(a).localeCompare(titleOf(b), 'he'),
  )
}

export function meetingColumn(meeting: Meeting, referenceDate: string): ColumnId | null {
  if (meeting.awaitingScheduling) return 'blocked'
  const date = meeting.date.value
  if (date === null) return null
  if (date === referenceDate) return 'today'
  if (date > referenceDate && date <= addDays(referenceDate, 7)) return 'week'
  return null
}

export function taskColumn(task: Task): ColumnId {
  if (task.done) return 'done'
  if (task.blocked) return 'blocked'
  return task.bucket
}

export function buildBoard(workspace: Workspace): Record<ColumnId, BoardCard[]> {
  const referenceDate = workspace.referenceDate ?? todayInIsrael()
  const columns: Record<ColumnId, BoardCard[]> = { today: [], week: [], blocked: [], done: [], later: [] }

  for (const task of workspace.tasks.filter((item) => !item.deleted)) columns[taskColumn(task)].push({ kind: 'task', task })
  for (const meeting of workspace.meetings.filter((item) => !item.deleted)) {
    const column = meetingColumn(meeting, referenceDate)
    if (column) columns[column].push({ kind: 'meeting', meeting })
  }

  for (const id of Object.keys(columns) as ColumnId[]) columns[id] = sortCards(columns[id], referenceDate)
  return columns
}
