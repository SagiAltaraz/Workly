import { describe, expect, it } from 'vitest'
import { ValidationError } from '../src/errors'
import {
  addBrief,
  addBriefItem,
  addMeeting,
  addTask,
  answerMissingDetail,
  clearField,
  deleteBriefItem,
  deleteMeeting,
  deleteTask,
  dismissQuestion,
  editBriefItem,
  editField,
  patchMeeting,
  patchTask,
  promoteSuggestion,
  resolveContradiction,
  restoreMeeting,
  setCardOrder,
  restoreTask,
} from '../src/pipeline/edits'
import { mergeExtraction } from '../src/pipeline/merge'
import { recompute } from '../src/pipeline/recompute'
import type { Workspace } from '../src/types/workspace'
import { emptyWorkspace, field, makeBrief, makeMeeting, makeTask } from './helpers'

const base = (): Workspace => ({ ...emptyWorkspace(), referenceDate: '2026-09-23' })
const withTasks = (...tasks: ReturnType<typeof makeTask>[]) => recompute({ ...base(), tasks })
const withMeetings = (...meetings: ReturnType<typeof makeMeeting>[]) => recompute({ ...base(), meetings })

describe('editField — a hand edit outranks a model', () => {
  it('marks the value as the user\'s, re-prioritizes and says what changed', () => {
    const start = withTasks(makeTask({ title: 'לחזור ליעל', dueDate: '2026-09-24' }))
    expect(start.tasks[0].bucket).toBe('tomorrow')
    const change = editField(start, { type: 'task', id: 'לחזור ליעל', key: 'dueDate' }, '2026-09-23')
    expect(change.workspace.tasks[0].dueDate.editedByUser).toBe(true)
    expect(change.workspace.tasks[0].bucket).toBe('today')
    expect(change.label).toContain('2026-09-24 ← 2026-09-23')
  })

  it('is never overwritten by a later model value and raises no contradiction', () => {
    const start = withTasks(makeTask({ title: 'משימה', quote: 'משימה א', dueDate: '2026-09-24' }))
    const edited = editField(start, { type: 'task', id: 'משימה', key: 'dueDate' }, '2026-09-25').workspace
    const merged = mergeExtraction(edited, {
      briefs: [],
      tasks: [makeTask({ title: 'משימה', quote: 'משימה א', dueDate: '2026-09-30' })],
      meetings: [],
    })
    expect(merged.tasks[0].dueDate.value).toBe('2026-09-25')
    expect(merged.contradictions).toEqual([])
  })

  it('rejects impossible dates, bad times and empty values', () => {
    const workspace = withTasks(makeTask({ title: 't' }))
    const target = { type: 'task', id: 't', key: 'dueDate' } as const
    expect(() => editField(workspace, target, '2026-02-31')).toThrow(ValidationError)
    expect(() => editField(workspace, { ...target, key: 'dueTime' }, '25:00')).toThrow(ValidationError)
    expect(() => editField(workspace, target, '  ')).toThrow(ValidationError)
  })

  it('a cleared value stays cleared when a later paste brings one back', () => {
    const start = withTasks(makeTask({ title: 't', quote: 'משימה', dueDate: '2026-09-24' }))
    const cleared = clearField(start, { type: 'task', id: 't', key: 'dueDate' }).workspace
    expect(cleared.tasks[0].dueDate.value).toBeNull()
    const merged = mergeExtraction(cleared, {
      briefs: [],
      tasks: [makeTask({ title: 't', quote: 'משימה', dueDate: '2026-09-27' })],
      meetings: [],
    })
    expect(merged.tasks[0].dueDate.value).toBeNull()
  })
})

describe('resolveContradiction', () => {
  const contradictory = () =>
    mergeExtraction(
      withMeetings(makeMeeting({ id: 'm', topic: 'פגישה', date: '2026-09-24', start: '09:30' })),
      { briefs: [], tasks: [], meetings: [makeMeeting({ id: 'n', topic: 'פגישה', date: '2026-09-24', start: '10:30' })] },
    )

  it('keeps the known value and raises a question that names the meeting', () => {
    const merged = recompute(contradictory())
    expect(merged.meetings[0].startTime.value).toBe('09:30')
    const question = merged.questions.find((item) => item.kind === 'contradiction')
    expect(question?.candidates).toEqual({ existing: '09:30', incoming: '10:30' })
    expect(question?.text).toContain('פגישה')
  })

  it('applies the chosen value as the user\'s and closes the question', () => {
    const merged = recompute(contradictory())
    const resolved = resolveContradiction(merged, merged.contradictions[0].id, 'useIncoming').workspace
    expect(resolved.meetings[0].startTime.value).toBe('10:30')
    expect(resolved.meetings[0].startTime.editedByUser).toBe(true)
    expect(resolved.questions.some((item) => item.kind === 'contradiction')).toBe(false)
  })
})

describe('tasks', () => {
  it('adds a task with the person\'s own values', () => {
    const { workspace } = addTask(base(), { title: 'לשלוח חשבונית', listedUnder: 'today', dueDate: null, dueTime: '15:00' })
    const [task] = workspace.tasks
    expect(task.dueDate).toMatchObject({ value: '2026-09-23', editedByUser: true })
    expect(task.bucket).toBe('today')
  })

  it('adds a task with an explicit date and a "week" task without inventing one', () => {
    const dated = addTask(base(), { title: 'א', listedUnder: 'today', dueDate: '2026-09-25', dueTime: null }).workspace.tasks[0]
    expect(dated.dueDate.value).toBe('2026-09-25')
    expect(dated.bucket).toBe('week')
    const undated = addTask(base(), { title: 'ב', listedUnder: 'week', dueDate: null, dueTime: null }).workspace.tasks[0]
    expect(undated.dueDate.value).toBeNull()
    expect(undated.bucket).toBe('week')
  })

  it('renames a task, changes date and time, and clears a time with null', () => {
    const start = withTasks(makeTask({ title: 'ישן', dueDate: '2026-09-24', dueTime: '10:00' }))
    const { workspace, label } = patchTask(start, 'ישן', { title: 'חדש', dueDate: '2026-09-23', dueTime: null })
    expect(workspace.tasks[0].title).toBe('חדש')
    expect(workspace.tasks[0].dueDate.value).toBe('2026-09-23')
    expect(workspace.tasks[0].dueTime.value).toBeNull()
    expect(label).toContain('חדש')
  })

  it('marks a task done and back', () => {
    const start = withTasks(makeTask({ title: 't' }))
    const done = patchTask(start, 't', { done: true }).workspace
    expect(done.tasks[0].done).toBe(true)
    expect(patchTask(done, 't', { done: false }).workspace.tasks[0].done).toBe(false)
  })

  it('releases a blocked task when its condition is marked as met', () => {
    const start = withTasks(makeTask({ title: 't', dueDate: '2026-09-23', signals: { condition: 'רק אם יאשרו' } }))
    expect(start.tasks[0].blocked).toBe(true)
    const freed = patchTask(start, 't', { conditionResolved: true }).workspace
    expect(freed.tasks[0].blocked).toBe(false)
    expect(freed.tasks[0].rule).toBe('p2Today')
    expect(() => patchTask(freed, 't', { conditionResolved: true })).toThrow(ValidationError)
  })

  it('deletes softly, restores, and never revives a deleted task from a re-paste', () => {
    const start = withTasks(makeTask({ title: 'א', quote: 'משימה א' }))
    const deleted = deleteTask(start, 'א').workspace
    expect(deleted.tasks[0].deleted).toBe(true)
    const repasted = mergeExtraction(deleted, { briefs: [], tasks: [makeTask({ title: 'א', quote: 'משימה א' })], meetings: [] })
    expect(repasted.tasks).toHaveLength(1)
    expect(repasted.tasks[0].deleted).toBe(true)
    expect(restoreTask(repasted, 'א').workspace.tasks[0].deleted).toBe(false)
  })

  it('a deleted task raises no questions', () => {
    const start = withTasks(makeTask({ title: 'א', quote: 'משימה א' }))
    const broken = { ...start, tasks: [{ ...start.tasks[0], quote: { ...start.tasks[0].quote, verified: false } }] }
    expect(recompute(broken).questions).toHaveLength(1)
    expect(recompute(deleteTask(broken, 'א').workspace).questions).toHaveLength(0)
  })
})

describe('moving a task between columns', () => {
  const at = (options: Parameters<typeof makeTask>[0]) => withTasks(makeTask({ title: 't', ...options }))

  it('today and tomorrow become real dates the person owns', () => {
    const start = at({ dueDate: '2026-09-30' })
    const today = patchTask(start, 't', { placement: 'today' })
    expect(today.workspace.tasks[0]).toMatchObject({ bucket: 'today' })
    expect(today.workspace.tasks[0].dueDate).toMatchObject({ value: '2026-09-23', editedByUser: true })
    expect(today.label).toContain('היום')

    const tomorrow = patchTask(start, 't', { placement: 'tomorrow' }).workspace.tasks[0]
    expect(tomorrow.dueDate.value).toBe('2026-09-24')
    expect(tomorrow.bucket).toBe('tomorrow')
  })

  it('"this week" is a place without a day: the date is cleared and the task is listed under the week', () => {
    const task = patchTask(at({ dueDate: '2026-09-23' }), 't', { placement: 'week' }).workspace.tasks[0]
    expect(task.dueDate.value).toBeNull()
    expect(task.dueDate.editedByUser).toBe(true)
    expect(task.bucket).toBe('week')
  })

  it('"later" clears both the date and the week listing', () => {
    const task = patchTask(at({ signals: { listedUnder: 'week' } }), 't', { placement: 'later' }).workspace.tasks[0]
    expect(task.bucket).toBe('later')
  })

  it('the person\'s move overrides a "can wait until later this week" from the text', () => {
    const start = at({ signals: { canWait: 'laterThisWeek', listedUnder: 'today' } })
    expect(start.tasks[0].bucket).toBe('week')
    const moved = patchTask(start, 't', { placement: 'today' }).workspace.tasks[0]
    expect(moved.bucket).toBe('today')
    expect(moved.signals.canWait).toBeNull()
  })

  it('keeps the hour and a later paste cannot move it back', () => {
    const moved = patchTask(at({ dueDate: '2026-09-23', dueTime: '11:00' }), 't', { placement: 'tomorrow' }).workspace
    expect(moved.tasks[0].dueTime.value).toBe('11:00')
    const merged = mergeExtraction(moved, { briefs: [], tasks: [makeTask({ title: 't', dueDate: '2026-09-23' })], meetings: [] })
    expect(merged.tasks[0].dueDate.value).toBe('2026-09-24')
  })

  it('can be combined with reopening a finished task', () => {
    const done = { ...at({ dueDate: '2026-09-23' }), tasks: [{ ...at({ dueDate: '2026-09-23' }).tasks[0], done: true }] }
    const reopened = patchTask(done, 't', { done: false, placement: 'tomorrow' }).workspace.tasks[0]
    expect(reopened).toMatchObject({ done: false, bucket: 'tomorrow' })
  })
})

describe('meetings', () => {
  it('adds a meeting with the person\'s own values', () => {
    const { workspace } = addMeeting(base(), { topic: 'סיכום', date: '2026-09-25', startTime: '10:00', endTime: '10:30', participants: ['יעל', ' '] })
    expect(workspace.meetings[0]).toMatchObject({ topic: 'סיכום', participants: ['יעל'] })
    expect(workspace.meetings[0].startTime.editedByUser).toBe(true)
  })

  it('moving a meeting keeps its length only when asked to', () => {
    const start = withMeetings(makeMeeting({ id: 'm', topic: 'א', date: '2026-09-24', start: '09:30', end: '10:00' }))
    const keeping = patchMeeting(start, 'm', { startTime: '11:00' }, { keepDuration: true })
    expect(keeping.workspace.meetings[0].endTime.value).toBe('11:30')
    expect(keeping.label).toContain('אותו אורך')
    const plain = patchMeeting(start, 'm', { startTime: '11:00' })
    expect(plain.workspace.meetings[0].endTime.value).toBe('10:00')
  })

  it('changes the topic and participants, and settles a contradiction on the field it edits', () => {
    const contradictory = mergeExtraction(
      withMeetings(makeMeeting({ id: 'm', topic: 'פגישה', date: '2026-09-24', start: '09:30' })),
      { briefs: [], tasks: [], meetings: [makeMeeting({ id: 'n', topic: 'פגישה', date: '2026-09-24', start: '10:30' })] },
    )
    expect(contradictory.contradictions).toHaveLength(1)
    const edited = patchMeeting(contradictory, 'm', { topic: 'חדשה', participants: ['דנה'], startTime: '10:30' }).workspace
    expect(edited.meetings[0]).toMatchObject({ topic: 'חדשה', participants: ['דנה'] })
    expect(edited.contradictions).toHaveLength(0)
  })

  it('deletes and restores, and a deleted meeting is not part of a conflict', () => {
    const start = withMeetings(
      makeMeeting({ id: 'a', date: '2026-09-24', start: '10:00', end: '11:00' }),
      makeMeeting({ id: 'b', topic: 'ב', date: '2026-09-24', start: '10:30', end: '11:30' }),
    )
    expect(start.meetings[0].conflictsWith).toEqual(['b'])
    const deleted = deleteMeeting(start, 'b').workspace
    expect(deleted.meetings[0].conflictsWith).toEqual([])
    expect(restoreMeeting(deleted, 'b').workspace.meetings[0].conflictsWith).toEqual(['b'])
  })
})

describe('multiple briefs', () => {
  const withBrief = (): Workspace => ({ ...base(), briefs: [makeBrief({ id: 'b' })] })
  const briefOf = (workspace: Workspace, id = 'b') => workspace.briefs.find((brief) => brief.id === id)!

  it('adds a blank brief for the "+ בריף חדש" button', () => {
    const { workspace, label } = addBrief(base())
    expect(workspace.briefs).toHaveLength(1)
    expect(label).toContain('נוסף בריף')
  })

  it('adds, edits and removes a deliverable on a specific brief', () => {
    const added = addBriefItem(withBrief(), 'b', 'deliverables', 'שלט גדול').workspace
    const id = briefOf(added).deliverables[0].id
    expect(briefOf(added).deliverables[0].field).toMatchObject({ value: 'שלט גדול', editedByUser: true })
    const edited = editBriefItem(added, id, 'שלט ענק').workspace
    expect(briefOf(edited).deliverables[0].field.value).toBe('שלט ענק')
    expect(deleteBriefItem(edited, id).workspace.briefs[0].deliverables[0].deleted).toBe(true)
  })

  it('creates a brief when the first item is added with no briefId (the empty-state buttons)', () => {
    const workspace = addBriefItem(base(), null, 'constraints', 'תנאי').workspace
    expect(workspace.briefs).toHaveLength(1)
    expect(workspace.briefs[0].constraints).toHaveLength(1)
  })

  it('adding an item to an unknown briefId fails, not silently to the wrong brief', () => {
    expect(() => addBriefItem(withBrief(), 'nope', 'deliverables', 'x')).toThrow()
  })

  it('an item id finds its own brief without saying which one', () => {
    const two = { ...base(), briefs: [makeBrief({ id: 'a' }), makeBrief({ id: 'b' })] }
    const added = addBriefItem(two, 'b', 'deliverables', 'שלט').workspace
    const id = briefOf(added).deliverables[0].id
    expect(briefOf(editBriefItem(added, id, 'שלט חדש').workspace).deliverables[0].field.value).toBe('שלט חדש')
    expect(briefOf(added, 'a').deliverables).toHaveLength(0)
  })

  it('turns an accepted suggestion into the person\'s own condition', () => {
    const suggested = {
      ...base(),
      briefs: [{ ...makeBrief({ id: 'b' }), suggestions: [{ id: 's', field: { ...field('הצעה'), status: 'assumed' as const }, deleted: false }] }],
    }
    const promoted = briefOf(promoteSuggestion(suggested, 's', 'constraints').workspace)
    expect(promoted.suggestions[0].deleted).toBe(true)
    expect(promoted.constraints[0].field).toMatchObject({ value: 'הצעה', status: 'stated', editedByUser: true })
  })

  it('answering a missing detail closes the question and records the answer', () => {
    const asked = recompute({
      ...base(),
      briefs: [{ ...makeBrief({ id: 'b' }), missingDetails: [{ id: 'd', field: field('שעות הפעילות'), deleted: false }] }],
    })
    expect(asked.questions.some((q) => q.text.includes('שעות הפעילות'))).toBe(true)
    const answered = answerMissingDetail(asked, 'd', '9:00-22:00').workspace
    expect(answered.questions.some((q) => q.text.includes('שעות הפעילות'))).toBe(false)
    expect(briefOf(answered).constraints[0].field.value).toBe('שעות הפעילות: 9:00-22:00')
  })

  it('names the brief in its questions once there is more than one', () => {
    const two = recompute({ ...base(), briefs: [makeBrief({ id: 'a', client: 'לקוח א' }), makeBrief({ id: 'b', client: 'לקוח ב' })] })
    const forA = two.questions.filter((q) => q.targetId === 'a')
    expect(forA.length).toBeGreaterThan(0)
    expect(forA.every((q) => q.text.includes('לקוח א'))).toBe(true)
  })
})

describe('dismissQuestion', () => {
  it('hides a question but never a contradiction', () => {
    const start = withMeetings(makeMeeting({ topic: 'א', date: '2026-09-24' }))
    const question = start.questions.find((item) => item.kind === 'awaitingScheduling')!
    const hidden = dismissQuestion(start, question.id).workspace
    expect(hidden.questions.some((item) => item.id === question.id)).toBe(false)

    const contradictory = recompute(
      mergeExtraction(
        withMeetings(makeMeeting({ id: 'm', topic: 'פגישה', date: '2026-09-24', start: '09:30' })),
        { briefs: [], tasks: [], meetings: [makeMeeting({ id: 'n', topic: 'פגישה', date: '2026-09-24', start: '10:30' })] },
      ),
    )
    const id = contradictory.questions.find((item) => item.kind === 'contradiction')!.id
    expect(() => dismissQuestion(contradictory, id)).toThrow(ValidationError)
  })
})

describe('merge — briefs', () => {
  const briefSignals = (overrides: Parameters<typeof makeBrief>[0] = {}) => ({ tasks: [], meetings: [], briefs: [makeBrief(overrides)] })

  it('a second, unrelated brief joins as its own card, not merged into the first', () => {
    const first = mergeExtraction(base(), briefSignals({ id: 'x', client: 'ביג פאשן גלילות' }))
    const merged = mergeExtraction(first, briefSignals({ id: 'y', client: 'רהיטי אלון' }))
    expect(merged.briefs).toHaveLength(2)
    expect(merged.briefs.map((b) => b.fields.client.value)).toEqual(['ביג פאשן גלילות', 'רהיטי אלון'])
  })

  it('the same client pasted again merges into the existing brief instead of duplicating it', () => {
    const first = mergeExtraction(base(), briefSignals({ id: 'x', client: 'ביג פאשן גלילות', campaign: 'קמפיין א' }))
    const merged = mergeExtraction(first, briefSignals({ id: 'z', client: 'ביג פאשן גלילות', message: 'מסר חדש' }))
    expect(merged.briefs).toHaveLength(1)
    expect(merged.briefs[0].fields.campaign.value).toBe('קמפיין א')
    expect(merged.briefs[0].fields.message.value).toBe('מסר חדש')
  })

  it('a conflicting value on the matched brief becomes a question, not an overwrite', () => {
    const first = mergeExtraction(base(), briefSignals({ id: 'x', client: 'ביג פאשן גלילות', campaign: 'קמפיין א' }))
    const merged = mergeExtraction(first, briefSignals({ id: 'z', client: 'ביג פאשן גלילות', campaign: 'קמפיין ב' }))
    expect(merged.briefs[0].fields.campaign.value).toBe('קמפיין א')
    expect(merged.contradictions).toHaveLength(1)
  })

  it('two briefs that state nothing in common both stay, rather than guessing they are the same', () => {
    const first = mergeExtraction(base(), briefSignals({ id: 'x' }))
    const merged = mergeExtraction(first, briefSignals({ id: 'y' }))
    expect(merged.briefs).toHaveLength(2)
  })
})

describe('merge — a known fact is never silently overwritten', () => {
  it('adds new items, leaves known ones alone and fills a gap', () => {
    const existing = withTasks(makeTask({ title: 'א', quote: 'משימה א', dueDate: null }))
    const merged = mergeExtraction(existing, {
      briefs: [],
      tasks: [makeTask({ title: 'א', quote: 'משימה א', dueDate: '2026-09-24' }), makeTask({ title: 'ב', quote: 'משימה ב' })],
      meetings: [],
    })
    expect(merged.tasks).toHaveLength(2)
    expect(merged.tasks[0].dueDate.value).toBe('2026-09-24')
  })

  it('turns two different stated values into a question', () => {
    const merged = mergeExtraction(
      withTasks(makeTask({ title: 'א', quote: 'משימה א', dueDate: '2026-09-24' })),
      { briefs: [], tasks: [makeTask({ title: 'א', quote: 'משימה א', dueDate: '2026-09-26' })], meetings: [] },
    )
    expect(merged.tasks[0].dueDate.value).toBe('2026-09-24')
    expect(merged.contradictions).toHaveLength(1)
  })
})

describe('setCardOrder', () => {
  const two = () => withTasks(makeTask({ title: 'א' }), makeTask({ title: 'ב' }))

  it('remembers the order of the cards that exist, each once, and says so', () => {
    const { workspace, label } = setCardOrder(two(), ['ב', 'א', 'ב', 'לא-קיים'])
    expect(workspace.cardOrder).toEqual(['ב', 'א'])
    expect(label).toContain('סדר')
  })

  it('does not count a deleted card', () => {
    const start = two()
    const deleted = deleteTask(start, 'א').workspace
    expect(setCardOrder(deleted, ['א', 'ב']).workspace.cardOrder).toEqual(['ב'])
  })

  it('refuses an order with nothing in it', () => {
    expect(() => setCardOrder(two(), ['לא-קיים'])).toThrow(ValidationError)
  })
})
