import { describe, expect, it } from 'vitest'
import type { Meeting } from '../types/meeting'
import type { Field } from '../types/provenance'
import type { Task } from '../types/task'
import type { Workspace } from '../types/workspace'
import { buildBoard, meetingColumn, reorderedIds, sortCards, type BoardCard } from './buildBoard'
import { buildIcs, buildTaskIcs } from './ics'
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
    canWait: null, notUrgent: null, listedUnder: null, dayPart: null,
  },
  meetingLink: null,
  deadline: { date: null, time: null, meetingId: null },
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
  dayPart: null,
  deleted: false,
  awaitingScheduling: date === null || start === null,
  weekdayMismatch: false,
  conflictsWith: [],
})

const workspace = (tasks: Task[], meetings: Meeting[]): Workspace => ({
  id: 'w', createdAt: '', updatedAt: '', referenceDate: '2026-09-23', referenceDateOrigin: 'text',
  sources: [], briefs: [], tasks, meetings, contradictions: [], dismissedQuestionIds: [], cardOrder: [], activity: [], questions: [],
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

  it('puts the preparation for a meeting right before that meeting, whatever its own priority', () => {
    const cards: BoardCard[] = [
      { kind: 'meeting', meeting: meeting('meeting', '2026-09-23', '20:00') },
      { kind: 'task', task: task('unrelated P1', { priority: 'p1', deadline: { date: '2026-09-23', time: '22:00', meetingId: null } }) },
      // P2 on its own, but it prepares for the 20:00 meeting, so it inherits that hour and sorts ahead of it.
      { kind: 'task', task: task('prepare', { priority: 'p2', deadline: { date: '2026-09-23', time: '20:00', meetingId: 'm' } }) },
      { kind: 'task', task: task('P2 later', { priority: 'p2' }) },
    ]
    expect(titles(sortCards(cards, '2026-09-23'))).toEqual(['prepare', 'meeting', 'unrelated P1', 'P2 later'])
  })

  it('puts a task the text called urgent before the others of its rank, even one with an hour', () => {
    const urgent = task('urgent', { priority: 'p2', signals: { ...task('x').signals, urgency: 'חשוב' } })
    const cards: BoardCard[] = [
      { kind: 'task', task: task('with hour', { priority: 'p2', deadline: { date: '2026-09-23', time: '09:00', meetingId: null } }) },
      { kind: 'task', task: urgent },
    ]
    expect(titles(sortCards(cards, '2026-09-23'))).toEqual(['urgent', 'with hour'])
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

describe('buildBoard — today, tomorrow and the week', () => {
  it('gives tomorrow its own column, and the rest of the week another', () => {
    const board = buildBoard(
      workspace(
        [
          task('today task'),
          task('tomorrow task', { bucket: 'tomorrow' }),
          task('week task', { bucket: 'week' }),
        ],
        [
          meeting('today meeting', '2026-09-23', '10:00'),
          meeting('tomorrow meeting', '2026-09-24', '10:00'),
          meeting('friday meeting', '2026-09-25', '10:00'),
          meeting('next week meeting', '2026-09-30', '10:00'),
          meeting('too far', '2026-10-01', '10:00'),
        ],
      ),
    )
    expect(titles(board.today)).toEqual(['today meeting', 'today task'])
    expect(titles(board.tomorrow)).toEqual(['tomorrow meeting', 'tomorrow task'])
    expect(titles(board.week)).toEqual(['friday meeting', 'next week meeting', 'week task'])
  })
})

describe('the person\'s own order', () => {
  const ref = '2026-09-23'
  const free = (title: string, priority: Task['priority'] = 'p2'): BoardCard => ({ kind: 'task', task: task(title, { priority }) })
  const timed = (title: string, priority: Task['priority'], time: string): BoardCard => ({
    kind: 'task',
    task: task(title, { priority, deadline: { date: ref, time, meetingId: null } }),
  })
  // Automatic order: X (P2, no hour), B (P3, 12:00), Y (P4, no hour).
  const cards = () => [free('X'), timed('B', 'p3', '12:00'), free('Y', 'p4')]

  it('changes nothing without an order', () => {
    expect(titles(sortCards(cards(), ref, []))).toEqual(['X', 'B', 'Y'])
  })

  it('rearranges the cards without an hour among their places, and cards with an hour never move', () => {
    expect(titles(sortCards(cards(), ref, ['Y', 'X']))).toEqual(['Y', 'B', 'X'])
  })

  it('keeps the automatic order of cards the person has not placed, after the ones they have', () => {
    const more = [...cards(), free('Z', 'p4')]
    expect(titles(sortCards(more, ref, ['Y']))).toEqual(['Y', 'B', 'X', 'Z'])
  })

  it('an hour still decides: changing it moves the card, and a card with an hour cannot be dragged', () => {
    const laterHour = [free('X'), timed('B', 'p2', '09:00'), timed('C', 'p2', '08:00')]
    expect(titles(sortCards(laterHour, ref, ['X']))).toEqual(['C', 'B', 'X'])
    expect(reorderedIds(cards(), 'B', 'X', 'before', [])).toBeNull()
  })
})

describe('reorderedIds', () => {
  const ref = '2026-09-23'
  const free = (title: string): BoardCard => ({ kind: 'task', task: task(title) })
  const cards = () => sortCards([free('A'), free('B'), free('C')], ref)

  it('puts a card before or after another', () => {
    expect(reorderedIds(cards(), 'C', 'A', 'before', [])).toEqual(['C', 'A', 'B'])
    expect(reorderedIds(cards(), 'A', 'C', 'after', [])).toEqual(['B', 'C', 'A'])
    expect(reorderedIds(cards(), 'A', 'C', 'before', [])).toEqual(['B', 'A', 'C'])
  })

  it('returns null when the card would stay where it is', () => {
    expect(reorderedIds(cards(), 'A', 'B', 'before', [])).toBeNull()
    expect(reorderedIds(cards(), 'B', 'A', 'after', [])).toBeNull()
    expect(reorderedIds(cards(), 'A', 'A', 'before', [])).toBeNull()
  })

  it('keeps the saved order of other columns', () => {
    expect(reorderedIds(cards(), 'C', 'A', 'before', ['Q', 'R'])).toEqual(['Q', 'R', 'C', 'A', 'B'])
  })
})

describe('meetingColumn', () => {
  it('knows which column a meeting is in, so a drop on the same column changes nothing', () => {
    expect(meetingColumn(meeting('m', '2026-09-24', '10:00'), '2026-09-23')).toBe('tomorrow')
    expect(meetingColumn(meeting('m', null, null), '2026-09-23')).toBe('blocked')
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

describe('buildTaskIcs', () => {
  it('turns a task with a time into a 30-minute block ending at the deadline', () => {
    const ics = buildTaskIcs([task('להגיש דו"ח', { dueDate: field('2026-09-24'), dueTime: field('17:00') })])
    expect(ics).toContain('DTSTART:20260924T170000')
    expect(ics).toContain('DTEND:20260924T173000')
    expect(ics).toContain('SUMMARY:להגיש דו"ח')
  })

  it('turns a task with only a date into an all-day reminder', () => {
    const ics = buildTaskIcs([task('בלי שעה', { dueDate: field('2026-09-24') })])
    expect(ics).toContain('DTSTART;VALUE=DATE:20260924')
    expect(ics).toContain('DTEND;VALUE=DATE:20260925')
  })

  it('exports a task that only has a deadline inherited from a meeting', () => {
    const ics = buildTaskIcs([task('הכנה', { deadline: { date: '2026-09-25', time: '09:00', meetingId: 'm' } })])
    expect(ics).toContain('DTSTART:20260925T090000')
  })

  it('skips a task with no date at all', () => {
    const ics = buildTaskIcs([task('בלי תאריך')])
    expect(ics.match(/BEGIN:VEVENT/g)).toBeNull()
  })
})
