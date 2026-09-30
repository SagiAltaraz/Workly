import { describe, expect, it } from 'vitest'
import { backfillDays } from '../src/pipeline/backfill'
import { recompute } from '../src/pipeline/recompute'
import type { Workspace } from '../src/types/workspace'
import { emptyWorkspace, field, makeMeeting, makeTask } from './helpers'

const source = (addedAt: string, referenceDate: string) => ({
  id: 's',
  text: 'טקסט',
  addedAt,
  referenceDate,
  referenceDateOrigin: 'today' as const,
})
const spanned = (value: string) => field(value, { span: { inputId: 's', start: 0, end: 4 } })

function workspaceWith(addedAt: string, referenceDate: string, task = makeTask({ dueTime: '19:00' })): Workspace {
  return { ...emptyWorkspace(), referenceDate, sources: [source(addedAt, referenceDate)], tasks: [{ ...task, quote: spanned('משימה') }] }
}

describe('backfillDays — not for every card', () => {
  it('leaves a card that waits on a meeting to take its day from that meeting', () => {
    const waiting = workspaceWith('2026-09-28T14:50:00Z', '2026-09-28', makeTask({ meetingPhrase: 'לפגישה עם שגיא' }))
    expect(backfillDays(waiting).tasks[0].dueDate.value).toBeNull()
  })
})

describe('backfillDays', () => {
  it('gives an hour with no day the day it would have got when it was typed', () => {
    // typed at 17:50, 19:00 was still ahead
    const ahead = backfillDays(workspaceWith('2026-09-28T14:50:00Z', '2026-09-28'))
    expect(ahead.tasks[0].dueDate).toMatchObject({ value: '2026-09-28', status: 'inferred', editedByUser: false })
    // typed at 20:10, 19:00 had already passed
    const passed = backfillDays(workspaceWith('2026-09-28T17:10:00Z', '2026-09-28'))
    expect(passed.tasks[0].dueDate.value).toBe('2026-09-29')
    expect(passed.tasks[0].dueDate.note).toContain('למחר')
  })

  it('puts an old card in the right column', () => {
    const fixed = recompute(backfillDays(workspaceWith('2026-09-28T14:50:00Z', '2026-09-28')))
    expect(fixed.tasks[0].bucket).toBe('today')
  })

  it('leaves a card that has a day, a place or the person\'s own edit alone', () => {
    const stamp = '2026-09-28T14:50:00Z'
    expect(backfillDays(workspaceWith(stamp, '2026-09-28', makeTask({ dueTime: '19:00', dueDate: '2026-10-05' }))).tasks[0].dueDate.value).toBe('2026-10-05')
    expect(backfillDays(workspaceWith(stamp, '2026-09-28', makeTask({ dueTime: '19:00', signals: { listedUnder: 'week' } }))).tasks[0].dueDate.value).toBeNull()
    const edited = makeTask({ dueTime: '19:00' })
    const cleared = { ...edited, dueDate: { ...edited.dueDate, editedByUser: true } }
    expect(backfillDays(workspaceWith(stamp, '2026-09-28', cleared)).tasks[0].dueDate.value).toBeNull()
  })

  it('gives a card with no hour either the day it was typed, and is idempotent', () => {
    const noHour = workspaceWith('2026-09-28T14:50:00Z', '2026-09-28', makeTask())
    expect(backfillDays(noHour).tasks[0].dueDate).toMatchObject({ value: '2026-09-28', status: 'inferred' })
    const once = backfillDays(workspaceWith('2026-09-28T14:50:00Z', '2026-09-28'))
    expect(backfillDays(once)).toEqual(once)
  })

  it('does the same for a meeting with an hour and no day', () => {
    const meeting = { ...makeMeeting({ start: '20:00' }), quote: spanned('פגישה') }
    const workspace: Workspace = { ...emptyWorkspace(), sources: [source('2026-09-28T14:50:00Z', '2026-09-28')], meetings: [meeting] }
    expect(backfillDays(workspace).meetings[0].date.value).toBe('2026-09-28')
  })
})
