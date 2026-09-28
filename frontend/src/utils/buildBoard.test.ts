import { describe, expect, it } from 'vitest'
import type { Meeting } from '../types/meeting'
import type { Field } from '../types/provenance'
import type { Task } from '../types/task'
import type { Workspace } from '../types/workspace'
import { buildBoard, sortCards, type BoardCard } from './buildBoard'
import { buildIcs } from './ics'
import { monthGrid, shiftMonth } from './calendarGrid'

const field = (value: string | null): Field => ({
  value,
  status: value === null ? 'missing' : 'stated',
  quote: null,
  span: null,
  verified: true,
  editedByUser: false,
  note: null,
})

const task = (title: string, overrides: Partial<Task> = {}): Task => ({
  id: title,
  title,
  quote: field(title),
  dueDate: field(null),
  dueTime: field(null),
  signals: {
    urgency: null, externalWaiting: null, blocksOthers: null, condition: null,
    canWait: null, notUrgent: null, listedUnder: null,
  },
  done: false,
  deleted: false,
  blocked: false,
  bucket: 'today',
  priority: 'p2',
  rule: 'p2Today',
  reason: '',
  ...overrides,
})

const meeting = (topic: string, date: string | null, start: string | null): Meeting => ({
  id: topic,
  topic,
  quote: field(topic),
  weekdayWritten: null,
  date: field(date),
  startTime: field(start),
  endTime: field(null),
  participants: [],
  deleted: false,
  awaitingScheduling: date === null || start === null,
  weekdayMismatch: false,
  conflictsWith: [],
})

const workspace = (tasks: Task[], meetings: Meeting[]): Workspace => ({
  id: 'w', createdAt: '', updatedAt: '', referenceDate: '2026-09-23', referenceDateOrigin: 'text',
  sources: [], brief: null, tasks, meetings, contradictions: [], dismissedQuestionIds: [], activity: [], questions: [],
})

const titles = (cards: BoardCard[]) =>
  cards.map((card) => (card.kind === 'task' ? card.task.title : card.meeting.topic))

describe('sortCards — mixed board', () => {
  it('ranks by priority first, so meetings do not all trail the tasks', () => {
    const cards: BoardCard[] = [
      { kind: 'task', task: task('P4 task', { priority: 'p4', dueTime: field('08:00') }) },
      { kind: 'meeting', meeting: meeting('meeting', '2026-09-23', '14:00') },
      { kind: 'task', task: task('P1 task', { priority: 'p1', dueTime: field('16:00') }) },
      { kind: 'task', task: task('P2 task', { priority: 'p2' }) },
    ]
    expect(titles(sortCards(cards, '2026-09-23'))).toEqual(['meeting', 'P1 task', 'P2 task', 'P4 task'])
  })

  it('sorts a dateless "today" task by its time next to dated tasks', () => {
    const cards: BoardCard[] = [
      { kind: 'task', task: task('dated', { priority: 'p1', dueDate: field('2026-09-23'), dueTime: field('12:30') }) },
      { kind: 'task', task: task('dateless', { priority: 'p1', dueTime: field('11:00') }) },
    ]
    expect(titles(sortCards(cards, '2026-09-23'))).toEqual(['dateless', 'dated'])
  })

  it('sorts by time inside the same rank, and puts no-time cards last', () => {
    const cards: BoardCard[] = [
      { kind: 'task', task: task('no time', { priority: 'p1' }) },
      { kind: 'task', task: task('late', { priority: 'p1', dueTime: field('16:00') }) },
      { kind: 'meeting', meeting: meeting('early meeting', '2026-09-23', '09:00') },
    ]
    expect(titles(sortCards(cards, '2026-09-23'))).toEqual(['early meeting', 'late', 'no time'])
  })
})

describe('buildBoard — columns', () => {
  it('routes done, blocked and bucketed tasks, and meetings by date', () => {
    const board = buildBoard(
      workspace(
        [
          task('done', { done: true }),
          task('blocked', { blocked: true, priority: null }),
          task('week task', { bucket: 'week' }),
          task('later task', { bucket: 'later' }),
        ],
        [
          meeting('today meeting', '2026-09-23', '10:00'),
          meeting('week meeting', '2026-09-25', '10:00'),
          meeting('far meeting', '2026-10-21', '10:00'),
          meeting('unscheduled', null, null),
        ],
      ),
    )
    expect(titles(board.done)).toEqual(['done'])
    expect(titles(board.blocked)).toEqual(['unscheduled', 'blocked'])
    expect(titles(board.week)).toEqual(['week meeting', 'week task'])
    expect(titles(board.today)).toEqual(['today meeting'])
    expect(titles(board.later)).toEqual(['later task'])
  })
})

describe('buildBoard — deleted items', () => {
  it('hides deleted tasks and meetings everywhere on the board', () => {
    const board = buildBoard(
      workspace(
        [task('gone', { deleted: true }), task('kept')],
        [{ ...meeting('cancelled', '2026-09-23', '10:00'), deleted: true }, meeting('held', '2026-09-23', '11:00')],
      ),
    )
    expect(titles(board.today)).toEqual(['held', 'kept'])
  })
})

describe('monthGrid', () => {
  it('starts on a Sunday and covers the whole month', () => {
    const grid = monthGrid(2026, 9)
    expect(grid[0].iso).toBe('2026-08-30')
    expect(grid.filter((day) => day.inMonth)).toHaveLength(30)
    expect(grid.length % 7).toBe(0)
  })

  it('moves across a year boundary', () => {
    expect(shiftMonth(2026, 12, 1)).toEqual({ year: 2027, month: 1 })
    expect(shiftMonth(2026, 1, -1)).toEqual({ year: 2025, month: 12 })
  })
})

describe('buildIcs', () => {
  it('exports scheduled meetings and skips the unscheduled', () => {
    const ics = buildIcs(
      [
        { ...meeting('פגישה, חשובה; דחופה', '2026-09-24', '09:30'), endTime: field('10:00') },
        meeting('ממתינה', null, null),
      ],
      new Date('2026-09-23T10:00:00Z'),
    )
    expect(ics).toContain('DTSTART:20260924T093000')
    expect(ics).toContain('DTEND:20260924T100000')
    expect(ics).toContain('SUMMARY:פגישה\\, חשובה\\; דחופה')
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(1)
    expect(ics.endsWith('\r\n')).toBe(true)
  })
})
