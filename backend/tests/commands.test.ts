import { describe, expect, it } from 'vitest'
import { applyCommands } from '../src/pipeline/commands/applyCommands'
import { parseCommand, type ParsedCommand } from '../src/pipeline/commands/parseCommand'
import { findMatches, matchScore } from '../src/pipeline/commands/textMatch'
import { removeRanges } from '../src/pipeline/removeSpans'
import { recompute } from '../src/pipeline/recompute'
import type { Workspace } from '../src/types/workspace'
import { commandSignal, emptyWorkspace, makeMeeting, makeTask } from './helpers'

const ref = '2026-09-23'
const text = 'הפגישה עם הלקוח עברה ל-11:00. תמחק את המשימה לסדר את תיקיית התמונות. התקבל אישור הקריאייטיב.'
const context = { inputId: 'i', text }

const parse = (overrides: Parameters<typeof commandSignal>[0]) => parseCommand(context, commandSignal(overrides), ref)

const workspace = (): Workspace =>
  recompute({
    ...emptyWorkspace(),
    referenceDate: ref,
    meetings: [
      makeMeeting({ id: 'client', topic: 'פגישה עם הלקוח של ביג פשן גלילות', date: '2026-09-24', start: '09:30', end: '10:00' }),
      makeMeeting({ id: 'talk', topic: 'שיחה עם הלקוח על התוצרים', date: '2026-10-12', start: '13:00', end: '13:45' }),
      makeMeeting({ id: 'team1', topic: 'פגישת צוות לסיכום ספטמבר', date: '2026-09-30', start: '14:00' }),
      makeMeeting({ id: 'team2', topic: 'פגישת צוות שבועית', date: '2026-10-07', start: '10:00' }),
    ],
    tasks: [
      makeTask({ title: 'לסדר את תיקיית התמונות ולמחוק כפילויות', dueDate: null }),
      makeTask({ title: 'להכין גרסה ראשונה לפרינט', dueDate: '2026-09-23', signals: { condition: 'רק אם התקבל אישור הקריאייטיב' } }),
      makeTask({ title: 'לסיים את הפרינט ושלטי החוצות', dueDate: '2026-09-28', signals: { condition: 'הכל תלוי באישור הקריאייטיב' } }),
      makeTask({ title: 'לחזור ליעל', signals: { condition: 'רק אחרי שנדבר עם דנה' } }),
    ],
  })

describe('textMatch', () => {
  it('finds the words a person used inside a longer title, ignoring Hebrew prefixes and bending', () => {
    expect(matchScore('הפגישה עם הלקוח', 'פגישה עם הלקוח של ביג פשן גלילות')).toBe(1)
    expect(matchScore('פגישת צוות', 'פגישה צוות')).toBe(1)
    expect(matchScore('התמונות', 'תמונות')).toBe(1)
  })

  it('returns one winner when it is clear and several when it is not', () => {
    const candidates = [
      { id: 'a', text: 'פגישה עם הלקוח של ביג פשן', label: 'a' },
      { id: 'b', text: 'שיחה עם הלקוח על התוצרים', label: 'b' },
    ]
    expect(findMatches(candidates, 'הפגישה עם הלקוח').map((c) => c.id)).toEqual(['a'])
    expect(findMatches([{ id: 'x', text: 'פגישת צוות א', label: '' }, { id: 'y', text: 'פגישת צוות ב', label: '' }], 'פגישת צוות')).toHaveLength(2)
  })

  it('never guesses below the minimum', () => {
    expect(findMatches([{ id: 'a', text: 'להתקשר לספק', label: '' }], 'הפגישה עם הלקוח')).toEqual([])
  })
})

describe('parseCommand', () => {
  it('reads the new time and date with code, and needs the quote to be in the text', () => {
    const parsed = parse({ action: 'editMeeting', quote: 'הפגישה עם הלקוח עברה ל-11:00', targetText: 'הפגישה עם הלקוח', timeText: '11:00' })
    expect(parsed).toMatchObject({ ok: true, command: { startTime: '11:00', date: null } })
    expect(parse({ action: 'addTask', quote: 'תוסיף משימה מומצאת', title: 'משימה', dateText: 'מחר' })).toMatchObject({ ok: false })
  })

  it('resolves a relative date against the reference date', () => {
    const local = { inputId: 'i', text: 'תוסיף משימה להתקשר לדני מחר' }
    const parsed = parseCommand(local, commandSignal({ action: 'addTask', quote: 'תוסיף משימה להתקשר לדני מחר', title: 'להתקשר לדני', dateText: 'מחר' }), ref)
    expect(parsed).toMatchObject({ ok: true, command: { date: '2026-09-24' } })
  })

  it('refuses a date or time it cannot read, and an instruction that says nothing', () => {
    expect(parse({ action: 'editMeeting', quote: 'הפגישה עם הלקוח עברה ל-11:00', targetText: 'הפגישה עם הלקוח', dateText: 'בקרוב' })).toMatchObject({ ok: false })
    expect(parse({ action: 'editMeeting', quote: 'הפגישה עם הלקוח עברה ל-11:00', targetText: 'הפגישה עם הלקוח' })).toMatchObject({ ok: false })
    expect(parse({ action: 'deleteTask', quote: 'תמחק את המשימה לסדר את תיקיית התמונות' })).toMatchObject({ ok: false })
  })

  it('does not trust a target that is not part of the sentence', () => {
    expect(parse({ action: 'deleteTask', quote: 'תמחק את המשימה לסדר את תיקיית התמונות', targetText: 'משהו אחר לגמרי' })).toMatchObject({ ok: false })
  })
})

describe('parseCommand — a description is not an instruction', () => {
  const list = { inputId: 'i', text: 'ביום חמישי, 24.9.2026, מ-09:30 עד 10:00, פגישה עם הלקוח.\nביום שני, 28.9.2026, מ-10:00 עד 10:30, מעבר אחרון.' }

  it('ignores a model that read a meeting list line as a request to add a meeting', () => {
    const parsed = parseCommand(
      list,
      commandSignal({ action: 'addMeeting', quote: 'ביום חמישי, 24.9.2026, מ-09:30 עד 10:00, פגישה עם הלקוח.', title: 'פגישה עם הלקוח', dateText: '24.9.2026', timeText: 'מ-09:30 עד 10:00' }),
      ref,
    )
    expect(parsed).toEqual({ ok: false, message: '', ignored: true })
  })

  it('accepts real requests to create', () => {
    for (const quote of ['תוסיף משימה להתקשר לדני', 'תקבע פגישה עם יעל', 'משימה חדשה: לשלוח חשבונית', 'צריך להוסיף משימה']) {
      const parsed = parseCommand({ inputId: 'i', text: quote }, commandSignal({ action: 'addTask', quote, title: 'משימה' }), ref)
      expect(parsed.ok, quote).toBe(true)
    }
  })

  it('an ignored instruction produces no result in the chat', () => {
    const ignored = parseCommand(list, commandSignal({ action: 'addMeeting', quote: 'ביום שני, 28.9.2026, מ-10:00 עד 10:30, מעבר אחרון.', title: 'מעבר אחרון' }), ref)
    expect(applyCommands(workspace(), [ignored]).results).toEqual([])
  })
})

describe('applyCommands', () => {
  const run = (parsed: ParsedCommand[]) => applyCommands(workspace(), parsed)

  it('moves a meeting, keeps its length and marks the new time as the user\'s', () => {
    const parsed = parse({ action: 'editMeeting', quote: 'הפגישה עם הלקוח עברה ל-11:00', targetText: 'הפגישה עם הלקוח', timeText: '11:00' })
    const { workspace: next, results } = run([parsed])
    const meeting = next.meetings.find((item) => item.id === 'client')!
    expect(results[0].status).toBe('applied')
    expect(meeting.startTime).toMatchObject({ value: '11:00', editedByUser: true })
    expect(meeting.endTime.value).toBe('11:30')
    expect(next.meetings.find((item) => item.id === 'talk')!.startTime.value).toBe('13:00')
  })

  it('deletes the one task that matches', () => {
    const parsed = parse({ action: 'deleteTask', quote: 'תמחק את המשימה לסדר את תיקיית התמונות', targetText: 'לסדר את תיקיית התמונות' })
    const { workspace: next, results } = run([parsed])
    expect(results[0].status).toBe('applied')
    expect(next.tasks.find((task) => task.title.startsWith('לסדר את'))!.deleted).toBe(true)
  })

  it('asks instead of guessing when several meetings match', () => {
    const local = { inputId: 'i', text: 'פגישת צוות עברה ל-11:00' }
    const parsed = parseCommand(local, commandSignal({ action: 'editMeeting', quote: 'פגישת צוות עברה ל-11:00', targetText: 'פגישת צוות', timeText: '11:00' }), ref)
    const { workspace: next, results } = run([parsed])
    expect(results[0].status).toBe('needsChoice')
    expect(results[0].choices.map((choice) => choice.targetId).sort()).toEqual(['team1', 'team2'])
    expect(results[0].command).not.toBeNull()
    expect(next.meetings.every((meeting) => meeting.startTime.editedByUser === false)).toBe(true)
  })

  it('says so when nothing matches, and changes nothing', () => {
    const parsed = parse({ action: 'deleteTask', quote: 'תמחק את המשימה לסדר את תיקיית התמונות', targetText: 'לסדר את תיקיית התמונות' })
    const empty = { ...workspace(), tasks: [] }
    const { results } = applyCommands(empty, [parsed])
    expect(results[0].status).toBe('notFound')
  })

  it('frees every task that was waiting for the condition that happened', () => {
    const parsed = parse({ action: 'unblockTask', quote: 'התקבל אישור הקריאייטיב', targetText: 'אישור הקריאייטיב' })
    const { workspace: next, results } = run([parsed])
    expect(results[0].status).toBe('applied')
    expect(next.tasks.filter((task) => task.blocked).map((task) => task.title)).toEqual(['לחזור ליעל'])
  })

  it('adds a task and a meeting straight away', () => {
    const local = { inputId: 'i', text: 'תוסיף משימה להתקשר לדני מחר ב-9 בבוקר. תקבע פגישה עם יעל ביום חמישי ב-15:00 על התקציב.' }
    const add = parseCommand(local, commandSignal({ action: 'addTask', quote: 'תוסיף משימה להתקשר לדני מחר ב-9 בבוקר', title: 'להתקשר לדני', dateText: 'מחר', timeText: 'ב-9 בבוקר' }), ref)
    const meet = parseCommand(local, commandSignal({ action: 'addMeeting', quote: 'תקבע פגישה עם יעל ביום חמישי ב-15:00 על התקציב', title: 'פגישה עם יעל על התקציב', dateText: 'יום חמישי', timeText: 'ב-15:00', participants: ['יעל'] }), ref)
    const { workspace: next } = run([add, meet])
    const task = next.tasks.at(-1)!
    expect(task).toMatchObject({ title: 'להתקשר לדני' })
    expect(task.dueDate.value).toBe('2026-09-24')
    expect(task.dueTime.value).toBe('09:00')
    expect(next.meetings.at(-1)).toMatchObject({ topic: 'פגישה עם יעל על התקציב', participants: ['יעל'] })
    expect(next.meetings.at(-1)!.date.value).toBe('2026-09-24')
  })

  it('reports an invalid instruction without stopping the ones after it', () => {
    const bad = parse({ action: 'editMeeting', quote: 'הפגישה עם הלקוח עברה ל-11:00', targetText: 'הפגישה עם הלקוח' })
    const good = parse({ action: 'deleteTask', quote: 'תמחק את המשימה לסדר את תיקיית התמונות', targetText: 'לסדר את תיקיית התמונות' })
    const { results } = run([bad, good])
    expect(results.map((item) => item.status)).toEqual(['invalid', 'applied'])
  })
})

describe('removeRanges', () => {
  it('removes handled sentences and leaves the rest', () => {
    expect(removeRanges('א. ב. ג.', [{ start: 3, end: 6 }])).toBe('א. ג.')
    expect(removeRanges('אבג', [])).toBe('אבג')
  })
})
