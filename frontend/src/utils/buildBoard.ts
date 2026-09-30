import type { Meeting } from '../types/meeting'
import type { Task } from '../types/task'
import type { Workspace } from '../types/workspace'
import { addDays, todayInIsrael } from './isoDate'

export type ColumnId = 'today' | 'tomorrow' | 'week' | 'blocked' | 'done' | 'later'

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
  const own = card.task.priority ? taskRank[card.task.priority] : blockedRank
  // Preparing for a meeting must come before it, however the task itself ranks.
  return card.task.deadline.meetingId ? Math.min(own, meetingRank) : own
}

// A task's deadline is its own or its meeting's. A task listed under "today" with no date of its own
// still sorts as today, not as undated.
function dateOf(card: BoardCard, referenceDate: string): string {
  const value = card.kind === 'task' ? (card.task.deadline.date ?? card.task.dueDate.value) : card.meeting.date.value
  if (value) return value
  return card.kind === 'task' && card.task.bucket === 'today' ? referenceDate : '9999-99-99'
}

function timeOf(card: BoardCard): string {
  const value = card.kind === 'task' ? (card.task.deadline.time ?? card.task.dueTime.value) : card.meeting.startTime.value
  return value ?? '99:99'
}

// At the same rank, day and hour a task comes before a meeting: a preparation sits right before what it prepares for.
function orderOf(card: BoardCard): number {
  return card.kind === 'task' ? 0 : 1
}

function titleOf(card: BoardCard): string {
  return card.kind === 'task' ? card.task.title : card.meeting.topic
}

export function idOf(card: BoardCard): string {
  return card.kind === 'task' ? card.task.id : card.meeting.id
}

// A card with an hour, its own or its meeting's, stays where that hour puts it. Only a card without
// one is the person's to arrange.
export function hasHour(card: BoardCard): boolean {
  return timeOf(card) !== '99:99'
}

// A task the text called urgent or important comes before the others of its rank.
function urgencyOf(card: BoardCard): number {
  return card.kind === 'task' && card.task.signals.urgency !== null ? 0 : 1
}

function automaticOrder(cards: BoardCard[], referenceDate: string): BoardCard[] {
  return [...cards].sort(
    (a, b) =>
      rankOf(a) - rankOf(b) ||
      urgencyOf(a) - urgencyOf(b) ||
      dateOf(a, referenceDate).localeCompare(dateOf(b, referenceDate)) ||
      timeOf(a).localeCompare(timeOf(b)) ||
      orderOf(a) - orderOf(b) ||
      titleOf(a).localeCompare(titleOf(b), 'he'),
  )
}

// Priority rank first, then by day and time inside the same rank (the day keeps a column that
// spans several days in true order). The person's own order then rearranges the cards that have no
// hour among the places the automatic order gave them, so cards with an hour never move.
export function sortCards(cards: BoardCard[], referenceDate: string, cardOrder: string[] = []): BoardCard[] {
  const automatic = automaticOrder(cards, referenceDate)
  if (cardOrder.length === 0) return automatic

  const place = new Map(cardOrder.map((id, index) => [id, index]))
  const position = (card: BoardCard) => place.get(idOf(card)) ?? Number.POSITIVE_INFINITY
  // Cards the person has not placed keep the automatic order, after the ones they have.
  const arranged = automatic
    .filter((card) => !hasHour(card))
    .sort((a, b) => (position(a) === position(b) ? 0 : position(a) < position(b) ? -1 : 1))

  let next = 0
  return automatic.map((card) => (hasHour(card) ? card : arranged[next++]))
}

// The new order to save when `draggedId` is dropped before or after `targetId` in a column (cards in
// their current display order), or null when nothing would change. Only a card without an hour can be
// dragged; it lands before the first card without an hour at or after the drop point.
export function reorderedIds(
  cards: BoardCard[],
  draggedId: string,
  targetId: string,
  position: 'before' | 'after',
  currentOrder: string[],
): string[] | null {
  const dragged = cards.find((card) => idOf(card) === draggedId)
  const targetIndex = cards.findIndex((card) => idOf(card) === targetId)
  if (!dragged || hasHour(dragged) || targetIndex === -1 || draggedId === targetId) return null

  const free = cards.filter((card) => !hasHour(card)).map(idOf)
  const others = free.filter((id) => id !== draggedId)
  const firstFree = cards
    .slice(position === 'before' ? targetIndex : targetIndex + 1)
    .map(idOf)
    .find((id) => id !== draggedId && others.includes(id))
  const at = firstFree === undefined ? others.length : others.indexOf(firstFree)
  const arranged = [...others.slice(0, at), draggedId, ...others.slice(at)]

  if (arranged.every((id, index) => id === free[index])) return null
  return [...currentOrder.filter((id) => !free.includes(id)), ...arranged]
}

export function meetingColumn(meeting: Meeting, referenceDate: string): ColumnId | null {
  if (meeting.awaitingScheduling) return 'blocked'
  const date = meeting.date.value
  if (date === null) return null
  if (date === referenceDate) return 'today'
  if (date === addDays(referenceDate, 1)) return 'tomorrow'
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
  const columns: Record<ColumnId, BoardCard[]> = { today: [], tomorrow: [], week: [], blocked: [], done: [], later: [] }

  for (const task of workspace.tasks.filter((item) => !item.deleted)) columns[taskColumn(task)].push({ kind: 'task', task })
  for (const meeting of workspace.meetings.filter((item) => !item.deleted)) {
    const column = meetingColumn(meeting, referenceDate)
    if (column) columns[column].push({ kind: 'meeting', meeting })
  }

  for (const id of Object.keys(columns) as ColumnId[]) columns[id] = sortCards(columns[id], referenceDate, workspace.cardOrder)
  return columns
}
