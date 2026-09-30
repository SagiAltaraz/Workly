import { describe, expect, it } from 'vitest'
import { runPipeline } from '../src/pipeline/runPipeline'
import { emptyWorkspace, stubExtractor } from './helpers'

// 10:00 in Israel on Monday 2026-09-28
const now = new Date('2026-09-28T07:00:00Z')

const taskSignal = (overrides: object) => ({
  title: 'משימה',
  quote: '',
  sectionHeading: null,
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

const meetingSignal = (overrides: object) => ({
  topic: 'פגישה',
  quote: '',
  sectionHeading: null,
  weekdayText: null,
  dateText: null,
  timeText: null,
  participants: [],
  ...overrides,
})

async function readTask(text: string, overrides: object) {
  const extractor = stubExtractor({ extractTasks: async () => [taskSignal({ quote: text, ...overrides })] })
  const { workspace } = await runPipeline(emptyWorkspace(), { text, userReferenceDate: null }, extractor, () => undefined, { now })
  return { task: workspace.tasks[0], workspace }
}

async function readMeeting(text: string, overrides: object) {
  const extractor = stubExtractor({ extractMeetings: async () => [meetingSignal({ quote: text, ...overrides })] })
  const { workspace } = await runPipeline(emptyWorkspace(), { text, userReferenceDate: null }, extractor, () => undefined, { now })
  return { meeting: workspace.meetings[0], workspace }
}

describe('everyday spelling and wording', () => {
  it('reads "מחרר" as tomorrow, keeps the quote as written and says what it read', async () => {
    const text = 'מחרר צריך להתקשר לדני בשעה 9 וחצי'
    const { task, workspace } = await readTask(text, { title: 'להתקשר לדני', dueDateText: 'מחרר', dueTimeText: 'בשעה 9 וחצי' })
    expect(task.dueDate).toMatchObject({ value: '2026-09-29', status: 'inferred', verified: true })
    expect(task.dueDate.note).toContain('"מחרר" ← "מחר"')
    expect(task.dueTime.value).toBe('09:30')
    expect(task.bucket).toBe('tomorrow')
    expect(task.quote.value).toBe(text)
    expect(workspace.questions).toEqual([])
  })

  it('reads an hour written in words, with a part of the day', async () => {
    const { task } = await readTask('להכין קלסרים עד שמונה וחצי בערב', { title: 'להכין קלסרים', dueTimeText: 'שמונה וחצי בערב' })
    expect(task.dueTime.value).toBe('20:30')
    expect(task.dueDate.value).toBe('2026-09-28')
    expect(task.bucket).toBe('today')
  })

  it('reads "until noon" even when noon is misspelled', async () => {
    const { task } = await readTask('צריכה לסגור את הדפוס היום עד הצהרים', {
      title: 'לסגור את הדפוס',
      dueDateText: 'היום',
      dueTimeText: 'עד הצהרים',
    })
    expect(task.dueTime.value).toBe('12:00')
    expect(task.rule).toBe('p2Today')
  })

  it('counts "in an hour" from the real clock in Israel, for a meeting', async () => {
    const { meeting, workspace } = await readMeeting('עוד שעה יש לי פגישה עם ניר', { topic: 'פגישה עם ניר', timeText: 'עוד שעה', participants: ['ניר'] })
    expect(meeting.date).toMatchObject({ value: '2026-09-28', status: 'inferred', verified: true })
    expect(meeting.startTime).toMatchObject({ value: '11:00', verified: true })
    expect(meeting.awaitingScheduling).toBe(false)
    expect(workspace.questions).toEqual([])
  })

  it('reads a weekday with a slip, and a part of the day is not a question', async () => {
    const { meeting, workspace } = await readMeeting('ביום חמשי בבוקר פגישה עם יעל', {
      topic: 'פגישה עם יעל',
      weekdayText: 'יום חמשי',
      dateText: 'יום חמשי',
      timeText: 'בבוקר',
    })
    expect(meeting.date).toMatchObject({ value: '2026-10-01', status: 'inferred' })
    expect(meeting.startTime.value).toBeNull()
    expect(meeting.dayPart).toBe('morning')
    expect(meeting.weekdayMismatch).toBe(false)
    expect(workspace.questions.map((q) => q.kind)).toEqual(['awaitingScheduling'])
    expect(workspace.questions.some((q) => q.kind === 'unresolvedValue')).toBe(false)
  })

  it('a part of the day is kept as a window, and asks nothing', async () => {
    const { task, workspace } = await readTask('לשלוח הצעת מחיר לאורי מחר אחה״צ', {
      title: 'לשלוח הצעת מחיר לאורי',
      dueDateText: 'מחר',
      dueTimeText: 'אחה״צ',
    })
    expect(task.dueDate.value).toBe('2026-09-29')
    expect(task.dueTime.value).toBeNull()
    expect(task.signals.dayPart).toBe('afternoon')
    expect(workspace.questions).toEqual([])
  })

  it('a part of the day with no day at all is for today', async () => {
    const { task } = await readTask('לסגור את התיקייה בערב', { title: 'לסגור את התיקייה', dueTimeText: 'בערב' })
    expect(task.dueDate).toMatchObject({ value: '2026-09-28', status: 'inferred' })
    expect(task.signals.dayPart).toBe('evening')
    expect(task.bucket).toBe('today')
  })

  it('still asks when an hour cannot be read at all', async () => {
    const { workspace } = await readTask('לחזור אליו בקרוב מאוד', { title: 'לחזור אליו', dueTimeText: 'בקרוב מאוד' })
    expect(workspace.questions.some((q) => q.kind === 'unresolvedValue')).toBe(true)
  })

  it('does not turn a real word into a date', async () => {
    const { task } = await readTask('ביום שני להתקשר לדני', { title: 'להתקשר לדני', dueDateText: 'ביום שני' })
    expect(task.dueDate).toMatchObject({ value: '2026-09-28', status: 'inferred' })
    expect(task.dueDate.note).toBeNull()
  })
})

describe('a weekday without a date', () => {
  it('a meeting on "Thursday" gets the next Thursday, worked out by code', async () => {
    const { meeting } = await readMeeting('ביום חמישי ב-9:30 פגישה עם הלקוח', {
      topic: 'פגישה עם הלקוח',
      weekdayText: 'יום חמישי',
      timeText: 'ב-9:30',
    })
    expect(meeting.date).toMatchObject({ value: '2026-10-01', status: 'inferred', verified: true })
    expect(meeting.startTime.value).toBe('09:30')
    expect(meeting.awaitingScheduling).toBe(false)
  })

  it('a written date still wins over the weekday', async () => {
    const { meeting } = await readMeeting('ביום חמישי, 24.9.2026, ב-9:30 פגישה עם הלקוח', {
      topic: 'פגישה עם הלקוח',
      weekdayText: 'יום חמישי',
      dateText: '24.9.2026',
      timeText: 'ב-9:30',
    })
    expect(meeting.date).toMatchObject({ value: '2026-09-24', status: 'stated' })
  })

  it('no weekday, no date and no hour leaves the meeting waiting', async () => {
    const { meeting } = await readMeeting('פגישה עם הלקוח בקרוב', { topic: 'פגישה עם הלקוח' })
    expect(meeting.date.value).toBeNull()
    expect(meeting.awaitingScheduling).toBe(true)
  })
})

describe('an hour with no day: today, or tomorrow when it has passed', () => {
  const at = (iso: string) => new Date(iso)
  // 17:50 in Israel on 2026-09-28
  const evening = at('2026-09-28T14:50:00Z')

  async function readAt(when: Date, kind: 'task' | 'meeting', overrides: object, text = 'טקסט', userReferenceDate: string | null = null) {
    const extractor =
      kind === 'task'
        ? stubExtractor({ extractTasks: async () => [taskSignal({ quote: text, ...overrides })] })
        : stubExtractor({ extractMeetings: async () => [meetingSignal({ quote: text, ...overrides })] })
    const { workspace } = await runPipeline(emptyWorkspace(), { text, userReferenceDate }, extractor, () => undefined, { now: when })
    return { task: workspace.tasks[0], meeting: workspace.meetings[0] }
  }

  it('an hour still ahead today is today', async () => {
    const { task } = await readAt(evening, 'task', { title: 'לדבר עם נעה', dueTimeText: 'לפני 19:00' }, 'אני רוצה לדבר עם נעה לפני 19:00')
    expect(task.dueDate).toMatchObject({ value: '2026-09-28', status: 'inferred' })
    expect(task.dueDate.note).toBeNull()
    expect(task.bucket).toBe('today')
  })

  it('an hour that has already passed today is tomorrow, and says why', async () => {
    const { task } = await readAt(evening, 'task', { title: 'לדבר עם נעה', dueTimeText: 'לפני 09:00' }, 'אני רוצה לדבר עם נעה לפני 09:00')
    expect(task.dueDate).toMatchObject({ value: '2026-09-29', status: 'inferred' })
    expect(task.dueDate.note).toContain('למחר')
    expect(task.bucket).toBe('tomorrow')
  })

  it('a part of the day that is over is tomorrow, one that is still on is today', async () => {
    const morning = await readAt(evening, 'task', { title: 'לשלוח דוח', dueTimeText: 'בבוקר' }, 'לשלוח דוח בבוקר')
    expect(morning.task.dueDate.value).toBe('2026-09-29')
    const night = await readAt(evening, 'task', { title: 'לשלוח דוח', dueTimeText: 'בערב' }, 'לשלוח דוח בערב')
    expect(night.task.dueDate.value).toBe('2026-09-28')
  })

  it('a day written in the text always wins over the clock', async () => {
    const { task } = await readAt(evening, 'task', { title: 'לדבר עם נעה', dueDateText: 'היום', dueTimeText: 'לפני 09:00' }, 'היום לדבר עם נעה לפני 09:00')
    expect(task.dueDate.value).toBe('2026-09-28')
  })

  it('a text that declares its own day is not judged by the clock', async () => {
    const { task } = await readAt(evening, 'task', { title: 'לדבר עם נעה', dueTimeText: 'לפני 09:00' }, 'לדבר עם נעה לפני 09:00', '2026-09-23')
    expect(task.dueDate.value).toBe('2026-09-23')
  })

  it('a meeting with an hour and no day follows the same rule', async () => {
    const ahead = await readAt(evening, 'meeting', { topic: 'פגישה עם שגיא', timeText: 'ב-20:00' }, 'פגישה ב-20:00 עם שגיא')
    expect(ahead.meeting.date).toMatchObject({ value: '2026-09-28' })
    expect(ahead.meeting.awaitingScheduling).toBe(false)
    const passed = await readAt(evening, 'meeting', { topic: 'פגישה עם שגיא', timeText: 'ב-09:00' }, 'פגישה ב-09:00 עם שגיא')
    expect(passed.meeting.date).toMatchObject({ value: '2026-09-29' })
    expect(passed.meeting.date.note).toContain('למחר')
  })

  it('a task under a heading that placed it is not pulled to today or tomorrow', async () => {
    const { task } = await readAt(evening, 'task', { title: 'לסגור דוח', sectionHeading: 'משימות להמשך השבוע', dueTimeText: 'לפני 09:00' }, 'משימות להמשך השבוע\nלסגור דוח לפני 09:00')
    expect(task.dueDate.value).toBeNull()
    expect(task.bucket).toBe('week')
  })
})
