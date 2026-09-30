import { describe, expect, it } from 'vitest'
import { runPipeline } from '../src/pipeline/runPipeline'
import type { StageEvent } from '../src/types/pipeline'
import { emptyWorkspace, stubExtractor } from './helpers'

const now = new Date('2026-09-27T09:00:00Z')

const tasksText = `המשימות שלי להיום
יום רביעי 23.9.2026 אלה הדברים שיש לי לעשות היום.
- לבדוק עם הלקוח אם הקריאייטיב מאושר. זה הכי דחוף לי. צריך תשובה עד 11:00.
- לסדר את התיקייה. זה ממש לא דחוף, אפשר גם בסוף השבוע.
- יש לי פגישת צוות ב־10:00 עד 10:20. נעבור על מה שכל אחד צריך לסיים היום.
- לחזור ליעל עד סוף היום. היא מחכה לתשובה.`

const taskSignal = (overrides: object) => ({
  title: 'משימה',
  quote: '',
  sectionHeading: 'המשימות שלי להיום',
  dueDateText: null,
  dueTimeText: null,
  urgencyWording: null,
  externalWaiting: null,
  blocksOthers: null,
  condition: null,
  canWait: null,
  notUrgent: null,
  relatedMeetingText: null,
  ...overrides,
})

const extractor = stubExtractor({
  extractTasks: async () => [
    taskSignal({
      title: 'לבדוק אישור קריאייטיב',
      quote: 'לבדוק עם הלקוח אם הקריאייטיב מאושר. זה הכי דחוף לי. צריך תשובה עד 11:00.',
      dueTimeText: 'עד 11:00',
      urgencyWording: 'זה הכי דחוף לי',
    }),
    taskSignal({
      title: 'לחזור ליעל',
      quote: 'לחזור ליעל עד סוף היום. היא מחכה לתשובה.',
      dueDateText: 'עד סוף היום',
      externalWaiting: 'היא מחכה לתשובה',
    }),
    taskSignal({
      title: 'לסדר תיקייה',
      quote: 'לסדר את התיקייה. זה ממש לא דחוף, אפשר גם בסוף השבוע.',
      notUrgent: 'ממש לא דחוף',
      canWait: { kind: 'laterThisWeek', quote: 'אפשר גם בסוף השבוע' },
    }),
    taskSignal({
      title: 'פגישת צוות',
      quote: 'יש לי פגישת צוות ב-10:00 עד 10:20. נעבור על מה שכל אחד צריך לסיים היום.',
      dueTimeText: 'ב-10:00 עד 10:20',
    }),
    taskSignal({
      title: 'משימה שהמודל המציא',
      quote: 'לשלוח הצעת מחיר ללקוח החדש',
      dueDateText: 'מחר',
    }),
  ],
  extractMeetings: async () => [
    {
      topic: 'פגישת צוות',
      quote: 'יש לי פגישת צוות ב-10:00 עד 10:20. נעבור על מה שכל אחד צריך לסיים היום.',
      sectionHeading: 'המשימות שלי להיום',
      weekdayText: null,
      dateText: null,
      timeText: 'ב-10:00 עד 10:20',
      participants: [],
    },
  ],
})

async function run(text = tasksText) {
  const events: StageEvent[] = []
  const result = await runPipeline(
    emptyWorkspace(),
    { text, userReferenceDate: null },
    extractor,
    (event) => events.push(event),
    { now },
  )
  return { workspace: result.workspace, events }
}

describe('runPipeline', () => {
  it('takes the reference date from the text heading, not from the clock', async () => {
    const { workspace } = await run()
    expect(workspace.referenceDate).toBe('2026-09-23')
    expect(workspace.referenceDateOrigin).toBe('text')
  })

  it('computes dates, times and priorities in code from the words the model copied', async () => {
    const { workspace } = await run()
    const urgent = workspace.tasks.find((task) => task.title === 'לבדוק אישור קריאייטיב')!
    // No date word in the item: it is due today only because it sits under the "today" heading.
    expect(urgent.dueDate.value).toBeNull()
    expect(urgent.bucket).toBe('today')
    expect(urgent.dueTime).toMatchObject({ value: '11:00', status: 'stated', verified: true })
    expect(urgent.rule).toBe('p1Critical')
    expect(urgent.reason).toContain('11:00')

    const callBack = workspace.tasks.find((task) => task.title === 'לחזור ליעל')!
    expect(callBack.dueDate).toMatchObject({ value: '2026-09-23', status: 'inferred', verified: true })
    expect(callBack.rule).toBe('p2Today')

    const relaxed = workspace.tasks.find((task) => task.title === 'לסדר תיקייה')!
    expect(relaxed.rule).toBe('p4Later')
    expect(relaxed.bucket).toBe('week')
  })

  it('keeps a value whose quote is not in the text but flags it and asks about it', async () => {
    const { workspace } = await run()
    const invented = workspace.tasks.find((task) => task.title === 'משימה שהמודל המציא')!
    expect(invented.quote.verified).toBe(false)
    expect(invented.quote.span).toBeNull()
    expect(workspace.questions.some((q) => q.kind === 'unverifiedQuote' && q.targetId === invented.id)).toBe(true)
  })

  it('records a span that points into the stored source text', async () => {
    const { workspace } = await run()
    const task = workspace.tasks[0]
    const source = workspace.sources.find((item) => item.id === task.quote.span?.inputId)!
    expect(source.text.slice(task.quote.span!.start, task.quote.span!.end)).toBe(task.quote.value)
  })

  it('a meeting with a time goes on the calendar and the plain task that repeated it is dropped', async () => {
    const { workspace, events } = await run()
    expect(workspace.meetings.map((meeting) => meeting.topic)).toEqual(['פגישת צוות'])
    expect(workspace.meetings[0].startTime.value).toBe('10:00')
    expect(workspace.tasks.some((task) => task.title === 'פגישת צוות')).toBe(false)
    expect(events.find((e) => e.stage === 'validate' && e.status === 'done')?.detail).toContain('אוחדו')
  })

  it('reports each stage and skips agents with nothing to read', async () => {
    const { events } = await run()
    const status = (stage: string) => events.filter((e) => e.stage === stage).map((e) => e.status)
    expect(status('extractTasks')).toEqual(['running', 'done'])
    expect(status('extractBrief')).toEqual(['skipped'])
    expect(status('prioritize')).toEqual(['running', 'done'])
  })

  it('keeps the board date when a later paste declares none', async () => {
    const first = await run()
    const { workspace: second } = await runPipeline(
      first.workspace,
      { text: '- ביום חמישי, 24.9.2026, מ־09:30 עד 10:00, שיחה עם בית הדפוס.', userReferenceDate: null },
      stubExtractor(),
      () => undefined,
      { now },
    )
    expect(second.referenceDate).toBe('2026-09-23')
    expect(second.sources).toHaveLength(2)
  })

  it('rejects empty text', async () => {
    await expect(run('   ')).rejects.toThrow('הטקסט ריק')
  })

  it('shows no brief and no brief questions when the text holds none', async () => {
    const { workspace } = await run()
    expect(workspace.briefs).toHaveLength(0)
  })
})

describe('runPipeline — instructions', () => {
  const messageText = 'הפגישה עם הלקוח עברה ל-11:00\nתוסיף משימה להתקשר לדני'
  const commandExtractor = (seen: string[]) =>
    stubExtractor({
      extractCommands: async () => [
        {
          action: 'editMeeting',
          quote: 'הפגישה עם הלקוח עברה ל-11:00',
          targetText: 'הפגישה עם הלקוח',
          title: null,
          dateText: null,
          timeText: '11:00',
          participants: [],
        },
      ],
      extractTasks: async ({ text }) => {
        seen.push(text)
        return []
      },
      extractMeetings: async ({ text }) => {
        seen.push(text)
        return []
      },
    })

  it('applies the instruction and keeps that sentence away from the agents that read information', async () => {
    const seen: string[] = []
    const start = {
      ...emptyWorkspace(),
      referenceDate: '2026-09-23',
      meetings: [
        {
          id: 'm', topic: 'פגישה עם הלקוח', quote: { value: 'q', status: 'stated' as const, quote: 'q', span: null, verified: true, editedByUser: false, note: null },
          weekdayWritten: null, participants: [], awaitingScheduling: false, weekdayMismatch: false, conflictsWith: [], deleted: false,
          date: { value: '2026-09-24', status: 'stated' as const, quote: null, span: null, verified: true, editedByUser: false, note: null },
          startTime: { value: '09:30', status: 'stated' as const, quote: null, span: null, verified: true, editedByUser: false, note: null },
          endTime: { value: '10:00', status: 'stated' as const, quote: null, span: null, verified: true, editedByUser: false, note: null },
        },
      ],
    }
    const result = await runPipeline(start, { text: messageText, userReferenceDate: null }, commandExtractor(seen), () => undefined, { now })
    expect(result.commandResults[0].status).toBe('applied')
    expect(result.workspace.meetings[0].startTime).toMatchObject({ value: '11:00', editedByUser: true })
    expect(seen.every((text) => !text.includes('עברה ל-11:00'))).toBe(true)
    expect(seen.some((text) => text.includes('להתקשר לדני'))).toBe(true)
    expect(result.label).toContain('11:00')
  })

  it('uses the board date, not the real clock, for "tomorrow"', async () => {
    const extractor = stubExtractor({
      extractCommands: async () => [
        { action: 'addTask', quote: 'תוסיף משימה להתקשר לדני מחר', targetText: null, title: 'להתקשר לדני', dateText: 'מחר', timeText: null, participants: [] },
      ],
    })
    const result = await runPipeline(
      { ...emptyWorkspace(), referenceDate: '2026-09-23', referenceDateOrigin: 'text' },
      { text: 'תוסיף משימה להתקשר לדני מחר', userReferenceDate: null },
      extractor,
      () => undefined,
      { now },
    )
    expect(result.workspace.tasks[0].dueDate.value).toBe('2026-09-24')
    expect(result.workspace.referenceDate).toBe('2026-09-23')
  })

  it('reports the instruction stage', async () => {
    const events: StageEvent[] = []
    await runPipeline(emptyWorkspace(), { text: 'שלום', userReferenceDate: null }, stubExtractor(), (e) => events.push(e), { now })
    expect(events.filter((e) => e.stage === 'extractCommands').map((e) => e.status)).toEqual(['running', 'done'])
  })
})

describe('runPipeline — a description mistaken for an instruction', () => {
  it('leaves the text for the readers when the model calls a meeting list line an instruction', async () => {
    const seen: string[] = []
    const line = 'ביום חמישי, 24.9.2026, מ־09:30 עד 10:00, פגישה עם הלקוח.'
    const extractor = stubExtractor({
      extractCommands: async () => [
        { action: 'addMeeting', quote: 'ביום חמישי, 24.9.2026, מ-09:30 עד 10:00, פגישה עם הלקוח.', targetText: null, title: 'פגישה עם הלקוח', dateText: '24.9.2026', timeText: 'מ-09:30 עד 10:00', participants: [] },
      ],
      extractMeetings: async ({ text }) => {
        seen.push(text)
        return []
      },
    })
    const result = await runPipeline(emptyWorkspace(), { text: line, userReferenceDate: null }, extractor, () => undefined, { now })
    expect(result.commandResults).toEqual([])
    expect(seen[0]).toContain('פגישה עם הלקוח')
    expect(result.workspace.meetings).toHaveLength(0)
  })
})

describe('runPipeline — a line typed into the chat', () => {
  const chatExtractor = stubExtractor({
    extractTasks: async () => [
      taskSignal({ title: 'לדבר עם נעה', quote: 'אני רוצה לדבר עם נעה לפני 19:00', sectionHeading: null, dueTimeText: 'לפני 19:00' }),
      taskSignal({ title: 'לסדר ארכיב', quote: 'לסדר ארכיב', sectionHeading: null }),
      taskSignal({ title: 'לסגור דוח', quote: 'לסגור דוח לפני 12:00', sectionHeading: 'משימות להמשך השבוע', dueTimeText: 'לפני 12:00' }),
    ],
  })
  const text = 'אני רוצה לדבר עם נעה לפני 19:00\nלסדר ארכיב\nמשימות להמשך השבוע\nלסגור דוח לפני 12:00'

  it('a task with an hour and no day is for today, and says how that was decided', async () => {
    const result = await runPipeline(emptyWorkspace(), { text, userReferenceDate: null }, chatExtractor, () => undefined, { now })
    const task = result.workspace.tasks.find((item) => item.title === 'לדבר עם נעה')!
    expect(task.dueDate).toMatchObject({ value: '2026-09-27', status: 'inferred', verified: true })
    expect(task.bucket).toBe('today')
    expect(task.rule).toBe('p2Today')
    expect(task.reason).toContain('19:00')
  })

  it('a task with neither a day nor an hour is for today, and says how that was decided', async () => {
    const result = await runPipeline(emptyWorkspace(), { text, userReferenceDate: null }, chatExtractor, () => undefined, { now })
    const task = result.workspace.tasks.find((item) => item.title === 'לסדר ארכיב')!
    expect(task.dueDate).toMatchObject({ value: '2026-09-27', status: 'inferred', verified: true })
    expect(task.dueDate.note).toContain('להיום')
    expect(task.bucket).toBe('today')
  })

  it('an hour under a heading that already placed the task does not pull it to today', async () => {
    const result = await runPipeline(emptyWorkspace(), { text, userReferenceDate: null }, chatExtractor, () => undefined, { now })
    const task = result.workspace.tasks.find((item) => item.title === 'לסגור דוח')!
    expect(task.dueDate.value).toBeNull()
    expect(task.bucket).toBe('week')
  })

  it('tells the person where each new card landed', async () => {
    const result = await runPipeline(emptyWorkspace(), { text, userReferenceDate: null }, chatExtractor, () => undefined, { now })
    expect(result.label).toContain('נוספה משימה "לדבר עם נעה" ← היום, עד 19:00')
    expect(result.label).toContain('נוספה משימה "לסדר ארכיב" ← היום')
    expect(result.label).toContain('נוספה משימה "לסגור דוח" ← השבוע הקרוב')
  })

  it('says so when the message held nothing to add', async () => {
    const result = await runPipeline(emptyWorkspace(), { text: 'שלום מה נשמע', userReferenceDate: null }, stubExtractor(), () => undefined, { now })
    expect(result.label).toContain('לא זוהו')
  })
})
