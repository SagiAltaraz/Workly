import { describe, expect, it } from 'vitest'
import { advanceDay } from '../src/pipeline/advanceDay'
import { mergeExtraction } from '../src/pipeline/merge'
import { recompute } from '../src/pipeline/recompute'
import { runPipeline } from '../src/pipeline/runPipeline'
import type { Workspace } from '../src/types/workspace'
import { emptyWorkspace, field, makeMeeting, makeTask, stubExtractor } from './helpers'

const noon = new Date('2026-09-28T09:00:00Z') // 12:00 in Israel
const nextDay = new Date('2026-09-29T09:00:00Z')

describe('advanceDay — a board that follows the clock moves on with it', () => {
  const board = (): Workspace =>
    recompute({
      ...emptyWorkspace(),
      referenceDate: '2026-09-28',
      referenceDateOrigin: 'today',
      tasks: [
        makeTask({ title: 'לא הושלמה', dueDate: '2026-09-28' }),
        { ...makeTask({ title: 'הושלמה', dueDate: '2026-09-28' }), done: true },
        makeTask({ title: 'למחר', dueDate: '2026-09-29' }),
        makeTask({ title: 'בלי יום' }),
      ],
    })

  it('does nothing on the same day', () => {
    expect(advanceDay(board(), noon)).toBeNull()
  })

  it('makes the date today and carries unfinished tasks of an earlier day to it', () => {
    const advanced = advanceDay(board(), nextDay)!
    expect(advanced.workspace.referenceDate).toBe('2026-09-29')
    const carried = advanced.workspace.tasks.find((task) => task.title === 'לא הושלמה')!
    expect(carried.dueDate).toMatchObject({ value: '2026-09-29', status: 'inferred', editedByUser: false })
    expect(carried.dueDate.note).toContain('עברה להיום')
    expect(carried.bucket).toBe('today')
    expect(advanced.label).toBe('עברו להיום 1 משימות שלא הושלמו')
  })

  it('leaves a finished task, a task for tomorrow and an undated task alone', () => {
    const tasks = advanceDay(board(), nextDay)!.workspace.tasks
    expect(tasks.find((task) => task.title === 'הושלמה')!.dueDate.value).toBe('2026-09-28')
    expect(tasks.find((task) => task.title === 'למחר')!.dueDate.value).toBe('2026-09-29')
    expect(tasks.find((task) => task.title === 'בלי יום')!.dueDate.value).toBeNull()
  })

  it('moves the date without writing a task move when nothing was carried', () => {
    const empty = { ...board(), tasks: [] }
    const advanced = advanceDay(empty, nextDay)!
    expect(advanced.workspace.referenceDate).toBe('2026-09-29')
    expect(advanced.label).toBeNull()
  })

  it('does not judge a board a text or a person pinned to a date', () => {
    const pinned = { ...board(), referenceDateOrigin: 'text' as const, referenceDate: '2026-09-23' }
    expect(advanceDay(pinned, nextDay)).toBeNull()
  })
})

describe('a card deleted and typed again', () => {
  const task = (title: string, quote: string) => makeTask({ title, quote })
  const buried = () => recompute({ ...emptyWorkspace(), referenceDate: '2026-09-28', tasks: [{ ...task('להתקשר לענר', 'להתקשר לענר'), deleted: true }] })

  it('a line typed on purpose is a new card', () => {
    const merged = mergeExtraction(buried(), { briefs: [], tasks: [task('להתקשר לענר', 'להתקשר לענר')], meetings: [] }, 'להתקשר לענר')
    expect(merged.tasks.filter((item) => !item.deleted)).toHaveLength(1)
    expect(merged.tasks).toHaveLength(2)
  })

  it('a long list pasted again does not bring the deleted card back', () => {
    const longText = 'להתקשר לענר\nלשלוח דוח\nלסדר תיקייה\nלבדוק חשבונית\nלהכין מצגת\nלקבוע פגישה'
    const merged = mergeExtraction(buried(), { briefs: [], tasks: [task('להתקשר לענר', 'להתקשר לענר')], meetings: [] }, longText)
    expect(merged.tasks.filter((item) => !item.deleted)).toHaveLength(0)
  })

  it('the same line typed twice is not added twice', () => {
    const once = mergeExtraction({ ...emptyWorkspace() }, { briefs: [], tasks: [task('לשלוח דוח', 'לשלוח דוח')], meetings: [] }, 'לשלוח דוח')
    const twice = mergeExtraction(once, { briefs: [], tasks: [task('לשלוח דוח', 'לשלוח דוח')], meetings: [] }, 'לשלוח דוח')
    expect(twice.tasks).toHaveLength(1)
  })

  it('a meeting deleted and typed again is a new meeting', () => {
    const start = recompute({ ...emptyWorkspace(), meetings: [{ ...makeMeeting({ topic: 'פגישה עם שגיא', quote: 'פגישה עם שגיא ב-20:00', date: '2026-09-28', start: '20:00' }), deleted: true }] })
    const merged = mergeExtraction(start, { briefs: [], tasks: [], meetings: [makeMeeting({ topic: 'פגישה עם שגיא', quote: 'פגישה עם שגיא ב-20:00', date: '2026-09-28', start: '20:00' })] }, 'פגישה עם שגיא ב-20:00')
    expect(merged.meetings.filter((item) => !item.deleted)).toHaveLength(1)
  })
})

describe('a message that adds nothing new says why', () => {
  const taskSignal = {
    title: 'להתקשר לענר', quote: 'הכי חשוב להתקשר לענר', sectionHeading: null, dueDateText: null, dueTimeText: null,
    urgencyWording: 'הכי חשוב', externalWaiting: null, blocksOthers: null, condition: null, canWait: null,
    notUrgent: null, relatedMeetingText: null,
  }
  const extractor = stubExtractor({ extractTasks: async () => [{ ...taskSignal }] })
  const send = (workspace: Workspace) =>
    runPipeline(workspace, { text: 'הכי חשוב להתקשר לענר', userReferenceDate: null }, extractor, () => undefined, { now: noon })

  it('typing the same task again says it already exists', async () => {
    const first = await send(emptyWorkspace())
    const second = await send(first.workspace)
    expect(second.workspace.tasks).toHaveLength(1)
    expect(second.label).toContain('כבר קיימת')
    expect(second.label).not.toContain('לא זוהו')
  })

  it('an urgent task typed with no day is critical today', async () => {
    const { workspace } = await send(emptyWorkspace())
    expect(workspace.tasks[0]).toMatchObject({ bucket: 'today', priority: 'p1', rule: 'p1Critical' })
  })

  it('a task deleted and typed again is a new card', async () => {
    const first = await send(emptyWorkspace())
    const deleted = { ...first.workspace, tasks: first.workspace.tasks.map((task) => ({ ...task, deleted: true })) }
    const again = await send(deleted)
    expect(again.workspace.tasks.filter((task) => !task.deleted)).toHaveLength(1)
    expect(again.label).toContain('נוספה משימה')
  })

  it('unused helper stays used', () => {
    expect(field('x').value).toBe('x')
  })
})

describe('a message that repeats a card that also has a deleted twin', () => {
  it('says the live card exists, not that it was deleted', async () => {
    const signal = {
      title: 'לשלוח דוח', quote: 'לשלוח דוח', sectionHeading: null, dueDateText: null, dueTimeText: null,
      urgencyWording: null, externalWaiting: null, blocksOthers: null, condition: null, canWait: null,
      notUrgent: null, relatedMeetingText: null,
    }
    const extractor = stubExtractor({ extractTasks: async () => [{ ...signal }] })
    const send = (ws: Workspace) => runPipeline(ws, { text: 'לשלוח דוח', userReferenceDate: null }, extractor, () => undefined, { now: noon })
    const first = await send(emptyWorkspace())
    const buried = { ...first.workspace, tasks: first.workspace.tasks.map((task) => ({ ...task, deleted: true })) }
    const second = await send(buried) // typed on purpose: a new live card next to the deleted one
    const third = await send(second.workspace) // repeated: the live card is what it repeats
    expect(third.label).toContain('כבר קיימת')
    expect(third.label).not.toContain('נמחקה קודם')
  })
})
