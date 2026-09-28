import { describe, expect, it } from 'vitest'
import { ValidationError } from '../src/errors'
import {
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
  emptyBrief,
  patchMeeting,
  patchTask,
  promoteSuggestion,
  resolveContradiction,
  restoreMeeting,
  restoreTask,
} from '../src/pipeline/edits'
import { mergeExtraction } from '../src/pipeline/merge'
import { recompute } from '../src/pipeline/recompute'
import type { Workspace } from '../src/types/workspace'
import { emptyWorkspace, field, makeMeeting, makeTask } from './helpers'

const base = (): Workspace => ({ ...emptyWorkspace(), referenceDate: '2026-09-23' })
const withTasks = (...tasks: ReturnType<typeof makeTask>[]) => recompute({ ...base(), tasks })
const withMeetings = (...meetings: ReturnType<typeof makeMeeting>[]) => recompute({ ...base(), meetings })

describe('editField — a hand edit outranks a model', () => {
  it('marks the value as the user\'s, re-prioritizes and says what changed', () => {
    const start = withTasks(makeTask({ title: 'לחזור ליעל', dueDate: '2026-09-24' }))
    expect(start.tasks[0].bucket).toBe('week')
    const change = editField(start, { type: 'task', id: 'לחזור ליעל', key: 'dueDate' }, '2026-09-23')
    expect(change.workspace.tasks[0].dueDate.editedByUser).toBe(true)
    expect(change.workspace.tasks[0].bucket).toBe('today')
    expect(change.label).toContain('2026-09-24 ← 2026-09-23')
  })

  it('is never overwritten by a later model value and raises no contradiction', () => {
    const start = withTasks(makeTask({ title: 'משימה', quote: 'משימה א', dueDate: '2026-09-24' }))
    const edited = editField(start, { type: 'task', id: 'משימה', key: 'dueDate' }, '2026-09-25').workspace
    const merged = mergeExtraction(edited, {
      brief: null,
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
      brief: null,
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
      { brief: null, tasks: [], meetings: [makeMeeting({ id: 'n', topic: 'פגישה', date: '2026-09-24', start: '10:30' })] },
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
    const repasted = mergeExtraction(deleted, { brief: null, tasks: [makeTask({ title: 'א', quote: 'משימה א' })], meetings: [] })
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
      { brief: null, tasks: [], meetings: [makeMeeting({ id: 'n', topic: 'פגישה', date: '2026-09-24', start: '10:30' })] },
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

describe('brief items', () => {
  const withBrief = (): Workspace => ({ ...base(), brief: emptyBrief() })

  it('adds, edits and removes a deliverable', () => {
    const added = addBriefItem(withBrief(), 'deliverables', 'שלט גדול').workspace
    const id = added.brief!.deliverables[0].id
    expect(added.brief!.deliverables[0].field).toMatchObject({ value: 'שלט גדול', editedByUser: true })
    const edited = editBriefItem(added, id, 'שלט ענק').workspace
    expect(edited.brief!.deliverables[0].field.value).toBe('שלט ענק')
    expect(deleteBriefItem(edited, id).workspace.brief!.deliverables[0].deleted).toBe(true)
  })

  it('creates a brief when the first item is added to a workspace without one', () => {
    expect(addBriefItem(base(), 'constraints', 'תנאי').workspace.brief?.constraints).toHaveLength(1)
  })

  it('turns an accepted suggestion into the person\'s own condition', () => {
    const suggested = { ...withBrief(), brief: { ...emptyBrief(), suggestions: [{ id: 's', field: { ...field('הצעה'), status: 'assumed' as const }, deleted: false }] } }
    const promoted = promoteSuggestion(suggested, 's', 'constraints').workspace.brief!
    expect(promoted.suggestions[0].deleted).toBe(true)
    expect(promoted.constraints[0].field).toMatchObject({ value: 'הצעה', status: 'stated', editedByUser: true })
  })

  it('answering a missing detail closes the question and records the answer', () => {
    const asked = recompute({ ...withBrief(), brief: { ...emptyBrief(), missingDetails: [{ id: 'd', field: field('שעות הפעילות'), deleted: false }] } })
    expect(asked.questions.some((q) => q.text.includes('שעות הפעילות'))).toBe(true)
    const answered = answerMissingDetail(asked, 'd', '9:00-22:00').workspace
    expect(answered.questions.some((q) => q.text.includes('שעות הפעילות'))).toBe(false)
    expect(answered.brief!.constraints[0].field.value).toBe('שעות הפעילות: 9:00-22:00')
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
        { brief: null, tasks: [], meetings: [makeMeeting({ id: 'n', topic: 'פגישה', date: '2026-09-24', start: '10:30' })] },
      ),
    )
    const id = contradictory.questions.find((item) => item.kind === 'contradiction')!.id
    expect(() => dismissQuestion(contradictory, id)).toThrow(ValidationError)
  })
})

describe('merge — a known fact is never silently overwritten', () => {
  it('adds new items, leaves known ones alone and fills a gap', () => {
    const existing = withTasks(makeTask({ title: 'א', quote: 'משימה א', dueDate: null }))
    const merged = mergeExtraction(existing, {
      brief: null,
      tasks: [makeTask({ title: 'א', quote: 'משימה א', dueDate: '2026-09-24' }), makeTask({ title: 'ב', quote: 'משימה ב' })],
      meetings: [],
    })
    expect(merged.tasks).toHaveLength(2)
    expect(merged.tasks[0].dueDate.value).toBe('2026-09-24')
  })

  it('turns two different stated values into a question', () => {
    const merged = mergeExtraction(
      withTasks(makeTask({ title: 'א', quote: 'משימה א', dueDate: '2026-09-24' })),
      { brief: null, tasks: [makeTask({ title: 'א', quote: 'משימה א', dueDate: '2026-09-26' })], meetings: [] },
    )
    expect(merged.tasks[0].dueDate.value).toBe('2026-09-24')
    expect(merged.contradictions).toHaveLength(1)
  })
})
