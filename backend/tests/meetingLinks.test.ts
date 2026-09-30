import { describe, expect, it } from 'vitest'
import { collapseOverlappingClaims } from '../src/pipeline/dedupe'
import { linkTasksToMeetings } from '../src/pipeline/linkMeetings'
import { prioritizeTask } from '../src/pipeline/prioritize'
import { recompute } from '../src/pipeline/recompute'
import type { Workspace } from '../src/types/workspace'
import { emptyWorkspace, makeMeeting, makeTask } from './helpers'

const ref = '2026-09-28'
const sagi = () => makeMeeting({ id: 'sagi', topic: 'פגישה עם שגיא', quote: 'יש לי היום פגישה ב-20:00 עם שגיא', date: ref, start: '20:00' })
const prep = () =>
  makeTask({
    title: 'להכין חומרים לפגישה עם שגיא',
    quote: 'הכי חשוב היום להכין חומרים לפגישה עם שגיא',
    dueDate: ref,
    signals: { urgency: 'הכי חשוב' },
    meetingPhrase: 'לפגישה עם שגיא',
  })
// The same task, asked for more gently: "important", not "the most important".
const gentlePrep = () => ({ ...prep(), signals: { ...prep().signals, urgency: 'חשוב' } })

describe('collapseOverlappingClaims — the evidence decides who keeps a sentence', () => {
  const sentence = 'יש לי פגישת צוות ב-10:00 עד 10:20. נעבור על מה שכל אחד צריך לסיים היום.'

  it('a meeting with a time goes to the calendar and the plain task that repeats it is dropped', () => {
    const result = collapseOverlappingClaims(
      [makeMeeting({ topic: 'פגישת צוות', quote: 'יש לי פגישת צוות ב-10:00 עד 10:20.', date: ref, start: '10:00' })],
      [makeTask({ quote: sentence })],
    )
    expect(result.meetings).toHaveLength(1)
    expect(result.tasks).toHaveLength(0)
    expect(result.droppedTasks).toBe(1)
  })

  it('keeps the task too when it adds urgency, a condition or a meeting link', () => {
    const result = collapseOverlappingClaims(
      [makeMeeting({ topic: 'פגישת צוות', quote: 'יש לי פגישת צוות ב-10:00 עד 10:20.', date: ref, start: '10:00' })],
      [makeTask({ quote: sentence, signals: { urgency: 'דחוף' } })],
    )
    expect(result.tasks).toHaveLength(1)
    expect(result.meetings).toHaveLength(1)
  })

  it('a "meeting" without a time that overlaps a to-do is the to-do misread, so the meeting is dropped', () => {
    const result = collapseOverlappingClaims(
      [makeMeeting({ topic: 'פגישה עם שגיא', quote: 'הכי חשוב היום להכין חומרים לפגישה עם שגיא' })],
      [prep()],
    )
    expect(result.meetings).toHaveLength(0)
    expect(result.tasks).toHaveLength(1)
    expect(result.droppedMeetings).toBe(1)
  })

  it('leaves unrelated meetings and tasks alone', () => {
    const result = collapseOverlappingClaims(
      [makeMeeting({ topic: 'בית הדפוס', quote: 'שיחה עם בית הדפוס על ההדפסה ועל מועד האספקה.', date: ref, start: '11:00' })],
      [makeTask({ quote: sentence })],
    )
    expect(result.meetings).toHaveLength(1)
    expect(result.tasks).toHaveLength(1)
  })
})

describe('linkTasksToMeetings', () => {
  it('ties a preparation task to the one meeting its words name', () => {
    const [task] = linkTasksToMeetings([prep()], [sagi(), makeMeeting({ id: 'other', topic: 'סיכום שבועי', date: ref, start: '09:00' })])
    expect(task.meetingLink).toEqual({ phrase: 'לפגישה עם שגיא', meetingId: 'sagi' })
  })

  it('does not guess between two meetings that fit', () => {
    const [task] = linkTasksToMeetings([prep()], [sagi(), makeMeeting({ id: 'sagi2', topic: 'פגישה נוספת עם שגיא', date: '2026-09-29', start: '10:00' })])
    expect(task.meetingLink?.meetingId).toBeNull()
  })

  it('does not link to a deleted meeting, and leaves a task without a phrase alone', () => {
    const [task] = linkTasksToMeetings([prep()], [{ ...sagi(), deleted: true }])
    expect(task.meetingLink?.meetingId).toBeNull()
    expect(linkTasksToMeetings([makeTask({ title: 'ללא קישור' })], [sagi()])[0].meetingLink).toBeNull()
  })

  it('works whichever arrives first, because recompute links every time', () => {
    const start: Workspace = { ...emptyWorkspace(), referenceDate: ref, tasks: [prep()] }
    expect(recompute(start).tasks[0].meetingLink?.meetingId).toBeNull()
    const withMeeting = recompute({ ...start, meetings: [sagi()] })
    expect(withMeeting.tasks[0].meetingLink?.meetingId).toBe('sagi')
  })
})

describe('prioritize — a task that prepares for a meeting inherits its hour', () => {
  const linked = () => linkTasksToMeetings([prep()], [sagi()])[0]

  it('is P1 when it is urgent and the meeting it prepares for is today at a fixed hour', () => {
    const task = prioritizeTask(linked(), ref, [sagi()])
    expect(task.rule).toBe('p1Critical')
    expect(task.deadline).toEqual({ date: ref, time: '20:00', meetingId: 'sagi' })
    expect(task.reason).toContain('20:00')
    expect(task.reason).toContain('פגישה עם שגיא')
  })

  it('without the meeting a plain "important" has no hard time and is only P2', () => {
    expect(prioritizeTask(gentlePrep(), ref, []).rule).toBe('p2Today')
  })

  it('"the most important" is critical today even without the meeting', () => {
    expect(prioritizeTask(prep(), ref, []).rule).toBe('p1Critical')
  })

  it('takes the meeting\'s day when the task states none, and its own time when it has one', () => {
    const noDate = { ...linked(), dueDate: makeTask().dueDate }
    expect(prioritizeTask(noDate, ref, [sagi()]).deadline.date).toBe(ref)
    const ownTime = { ...linked(), dueTime: makeTask({ dueTime: '18:00' }).dueTime }
    expect(prioritizeTask(ownTime, ref, [sagi()]).deadline.time).toBe('18:00')
  })

  it('does not take a meeting\'s hour from a different day', () => {
    const tomorrowsMeeting = { ...sagi(), date: makeMeeting({ date: '2026-09-29' }).date }
    const task = prioritizeTask({ ...linked(), signals: { ...linked().signals, urgency: 'חשוב' } }, ref, [tomorrowsMeeting])
    expect(task.deadline.time).toBeNull()
    expect(task.rule).toBe('p2Today')
  })
})
