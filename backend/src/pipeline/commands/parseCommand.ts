import type { CommandSignal } from '../../agents/commands/commands.schema'
import type { ResolvedCommand } from '../../types/command'
import { appearsInSource, type SourceContext } from '../fields'
import { normalizeText } from '../normalize'
import { findQuote } from '../quoteMatching'
import { parseDate } from '../parseDate'
import { parseTimeRange } from '../parseTime'

export type ParsedCommand =
  | { ok: true; command: ResolvedCommand; targetText: string | null }
  // `ignored` means it was not really an instruction: the text stays for the agents that read information.
  | { ok: false; message: string; ignored?: boolean }

const needsTarget = new Set([
  'editTask',
  'completeTask',
  'reopenTask',
  'deleteTask',
  'unblockTask',
  'editMeeting',
  'deleteMeeting',
])

const invalid = (message: string): ParsedCommand => ({ ok: false, message })

// Creating something needs a request to create it. A line that only describes a meeting or a task
// is information, however much it looks like scheduling, so a model that reads it as an
// instruction is overruled here.
const creationRequest = new RegExp(
  [
    '(?<!\\p{Script=Hebrew})(?:תוסיף|תוסיפי|תוסיפו|הוסף|הוסיפי|הוסיפו|להוסיף|תקבע|תקבעי|קבע|לקבוע|תצור|צור|ליצור|תיצור|תפתח|פתח|לפתוח|תרשום|רשום|לרשום|תזמן|לזמן|תכניס|הכנס|להכניס|תשים|שים)(?!\\p{Script=Hebrew})',
    '(?:משימה|פגישה) חדשה',
  ].join('|'),
  'u',
)

// Checks the instruction against the text and turns every date and time in it into values.
// The model only copied words; this is where they are read.
export function parseCommand(
  context: SourceContext,
  signal: CommandSignal,
  referenceDate: string,
): ParsedCommand {
  const quote = normalizeText(signal.quote)
  if (!appearsInSource(context, quote)) return invalid('לא הצלחתי לאמת את ההוראה מול הטקסט, ולכן לא ביצעתי אותה.')

  if ((signal.action === 'addTask' || signal.action === 'addMeeting') && !creationRequest.test(quote)) {
    return { ok: false, message: '', ignored: true }
  }

  const targetText = signal.targetText ? normalizeText(signal.targetText) : null
  if (needsTarget.has(signal.action)) {
    if (!targetText) return invalid(`ההוראה "${quote}" לא מציינת על איזה פריט מדובר.`)
    if (findQuote(quote, targetText) === null) return invalid(`לא הצלחתי לאמת על איזה פריט ההוראה "${quote}".`)
  }

  let date: string | null = null
  if (signal.dateText) {
    const parsed = parseDate(normalizeText(signal.dateText), referenceDate)
    if (!parsed) return invalid(`לא הבנתי את התאריך "${signal.dateText}".`)
    date = parsed.date
  }

  let startTime: string | null = null
  let endTime: string | null = null
  if (signal.timeText) {
    const range = parseTimeRange(normalizeText(signal.timeText))
    if (!range.start) return invalid(`לא הבנתי את השעה "${signal.timeText}".`)
    startTime = range.start.time
    endTime = range.end?.time ?? null
  }

  const title = signal.title ? normalizeText(signal.title) : null
  const participants = signal.participants.map(normalizeText).filter((name) => name.length > 0)

  if ((signal.action === 'addTask' || signal.action === 'addMeeting') && !title) {
    return invalid(`ההוראה "${quote}" לא כוללת שם.`)
  }
  const changesSomething = title !== null || date !== null || startTime !== null || participants.length > 0
  if ((signal.action === 'editTask' || signal.action === 'editMeeting') && !changesSomething) {
    return invalid(`ההוראה "${quote}" לא אומרת מה לשנות.`)
  }

  return {
    ok: true,
    targetText,
    command: { action: signal.action, quote, title, date, startTime, endTime, participants },
  }
}
