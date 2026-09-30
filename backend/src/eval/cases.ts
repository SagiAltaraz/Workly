import type { Bucket, DayPart, PriorityTier } from '../types/task'

// What must be true of a task or a meeting once the messages have been read. Anything left out is
// not checked. `null` means "must be empty".
export interface TaskExpectation {
  kind: 'task'
  // A piece of the title, to find the task among the others.
  title?: string
  date?: string | null
  time?: string | null
  bucket?: Bucket
  priority?: PriorityTier | null
  // The hour the task really has to be done by, which may come from a meeting.
  deadlineTime?: string | null
  dayPart?: DayPart | null
  blocked?: boolean
  // The title must contain this exact word, spelled correctly.
  titleIncludes?: string
}

export interface MeetingExpectation {
  kind: 'meeting'
  topic?: string
  date?: string | null
  time?: string | null
  dayPart?: DayPart | null
  awaiting?: boolean
}

export type Expectation =
  | TaskExpectation
  | MeetingExpectation
  | { kind: 'taskCount'; count: number }
  | { kind: 'meetingCount'; count: number }
  | { kind: 'noQuestions' }

export interface EvalCase {
  name: string
  // Sent one after the other to the same workspace, like typing into the chat.
  messages: string[]
  expect: Expectation[]
}

// The moment every case runs at: Monday 2026-09-28, 10:00 in Israel. "Tomorrow" is the 29th.
export const evalNow = new Date('2026-09-28T07:00:00Z')

export const cases: EvalCase[] = [
  {
    name: 'מחרר (שגיאת כתיב) + שעה במילים',
    messages: ['מחרר צריך להתקשר לדני בשעה 9 וחצי'],
    expect: [{ kind: 'task', title: 'דני', date: '2026-09-29', time: '09:30', bucket: 'tomorrow' }, { kind: 'noQuestions' }],
  },
  {
    name: 'שמונה וחצי בערב',
    messages: ['להכין קלסרים עד שמונה וחצי בערב'],
    expect: [{ kind: 'task', title: 'קלסרים', date: '2026-09-28', time: '20:30', bucket: 'today' }],
  },
  {
    name: 'עד הצהרים (כתיב חסר)',
    messages: ['צריכה לסגור את הדפוס היום עד הצהרים'],
    expect: [{ kind: 'task', title: 'הדפוס', date: '2026-09-28', time: '12:00' }],
  },
  {
    name: 'מחר אחה״צ (חלון, לא שעה)',
    messages: ['לשלוח הצעת מחיר לאורי מחר אחה״צ'],
    expect: [{ kind: 'task', title: 'הצעת מחיר', date: '2026-09-29', time: null, dayPart: 'afternoon' }, { kind: 'noQuestions' }],
  },
  {
    name: 'עוד שעה (פגישה)',
    messages: ['עוד שעה יש לי פגישה עם ניר'],
    expect: [{ kind: 'meeting', topic: 'ניר', date: '2026-09-28', time: '11:00' }, { kind: 'noQuestions' }],
  },
  {
    name: 'בעוד שעתיים (משימה)',
    messages: ['בעוד שעתיים להתקשר לאבי'],
    expect: [{ kind: 'task', title: 'אבי', date: '2026-09-28', time: '12:00' }],
  },
  {
    name: 'ביום חמשי בבוקר (כתיב + חלון)',
    messages: ['ביום חמשי בבוקר פגישה עם יעל'],
    expect: [{ kind: 'meeting', topic: 'יעל', date: '2026-10-01', time: null, dayPart: 'morning', awaiting: true }],
  },
  {
    name: 'רבע לשמונה בערב (פגישה)',
    messages: ['היום רבע לשמונה בערב יש לי פגישה עם דנה'],
    expect: [{ kind: 'meeting', topic: 'דנה', date: '2026-09-28', time: '19:45' }],
  },
  {
    name: 'יום ראשון בעשר וחצי',
    messages: ['ביום ראשון בעשר וחצי פגישה עם דנה על התקציב'],
    expect: [{ kind: 'meeting', topic: 'דנה', date: '2026-10-04', time: '10:30' }],
  },
  {
    name: 'שעה בלי יום = היום',
    messages: ['אני רוצה לדבר עם נעה לפני 19:00'],
    expect: [{ kind: 'task', title: 'נעה', date: '2026-09-28', time: '19:00', bucket: 'today', priority: 'p2' }],
  },
  {
    name: 'שעה שכבר עברה היום = מחר',
    messages: ['אני רוצה לדבר עם נעה לפני 09:00'],
    expect: [{ kind: 'task', title: 'נעה', date: '2026-09-29', time: '09:00', bucket: 'tomorrow' }],
  },
  {
    name: 'פגישה עם שעה בלי יום = היום',
    messages: ['יש לי פגישה ב-20:00 עם שגיא'],
    expect: [{ kind: 'meeting', topic: 'שגיא', date: '2026-09-28', time: '20:00', awaiting: false }],
  },
  {
    name: 'משימה בלי יום ובלי שעה = היום',
    messages: ['להתקשר לספק'],
    expect: [{ kind: 'task', title: 'ספק', date: '2026-09-28', time: null, bucket: 'today' }],
  },
  {
    name: 'דחוף בלי יום = קריטי היום',
    messages: ['הכי חשוב להתקשר לענר לראות שדברו עם הספקה'],
    expect: [{ kind: 'task', title: 'ענר', date: '2026-09-28', bucket: 'today', priority: 'p1' }],
  },
  {
    name: 'חשוב (לא דחוף) בלי שעה = P2',
    messages: ['חשוב להתקשר היום לענר'],
    expect: [{ kind: 'task', title: 'ענר', bucket: 'today', priority: 'p2' }],
  },
  {
    name: 'מחקתי וכתבתי מחדש = כרטיס חדש',
    messages: ['להתקשר לענר', 'תמחק את המשימה להתקשר לענר', 'להתקשר לענר'],
    expect: [{ kind: 'taskCount', count: 1 }, { kind: 'task', title: 'ענר', date: '2026-09-28' }],
  },
  {
    name: 'עד סוף היום',
    messages: ['לשלוח את הדוח עד סוף היום'],
    expect: [{ kind: 'task', title: 'דוח', date: '2026-09-28', time: null, bucket: 'today' }],
  },
  {
    name: 'הצ׳אט מהצילום: הכנה לפגישה יורשת שעה',
    messages: ['יש לי היום פגישה ב-20:00 עם שגיא', 'חשוב להתקשר היום לענר', 'הכי חשוב היום להכין חומרים לפגישה עם שגיא'],
    expect: [
      { kind: 'meetingCount', count: 1 },
      { kind: 'meeting', topic: 'שגיא', date: '2026-09-28', time: '20:00' },
      { kind: 'taskCount', count: 2 },
      { kind: 'task', title: 'חומרים', priority: 'p1', deadlineTime: '20:00' },
      { kind: 'task', title: 'ענר', priority: 'p2', time: null },
    ],
  },
  {
    name: 'הוראה: הפגישה עברה',
    messages: ['ביום חמישי ב-9:30 עד 10:00 פגישה עם הלקוח', 'הפגישה עם הלקוח עברה ל-11:00'],
    expect: [{ kind: 'meetingCount', count: 1 }, { kind: 'meeting', topic: 'לקוח', date: '2026-10-01', time: '11:00' }],
  },
  {
    name: 'הוראה: מחיקת משימה',
    messages: ['להתקשר לספק השילוט', 'תמחק את המשימה להתקשר לספק השילוט'],
    expect: [{ kind: 'taskCount', count: 0 }],
  },
  {
    name: 'הוראה: הוספה עם מחר',
    messages: ['תוסיף משימה להתקשר לדני מחר ב-9 בבוקר'],
    expect: [{ kind: 'task', title: 'דני', date: '2026-09-29', time: '09:00' }],
  },
  {
    name: 'תיקון כתיב בכותרת',
    messages: ['לשלוח חשבוניות ללוקוח מחר'],
    expect: [{ kind: 'task', titleIncludes: 'ללקוח' }],
  },
  {
    name: 'הודעה בלי תוכן',
    messages: ['מה שלומך היום'],
    expect: [{ kind: 'taskCount', count: 0 }, { kind: 'meetingCount', count: 0 }],
  },
]
