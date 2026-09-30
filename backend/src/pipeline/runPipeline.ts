import { randomUUID } from 'node:crypto'
import type { Extractor } from '../agents/extractor'
import { ValidationError } from '../errors'
import type { Brief } from '../types/brief'
import type { CommandResult } from '../types/command'
import type { Meeting } from '../types/meeting'
import type { Stage, StageEvent, StageStatus } from '../types/pipeline'
import type { Bucket, Task } from '../types/task'
import type { Workspace } from '../types/workspace'
import { buildBriefs } from './buildBrief'
import { buildMeetings } from './buildMeetings'
import { buildTasks } from './buildTasks'
import { classify, describeSegments, routeSegments } from './classify'
import { applyCommands } from './commands/applyCommands'
import { parseCommand } from './commands/parseCommand'
import { collapseOverlappingClaims } from './dedupe'
import type { Change } from './edits'
import { mergeExtraction, type Extraction } from './merge'
import { normalizeText } from './normalize'
import { findQuote } from './quoteMatching'
import { recompute } from './recompute'
import { detectReferenceDate } from './referenceDate'
import { removeRanges } from './removeSpans'

export interface PipelineRequest {
  text: string
  userReferenceDate: string | null
}

export type StageListener = (event: StageEvent) => void

interface RunOptions {
  now?: Date
}

export interface PipelineResult extends Change {
  commandResults: CommandResult[]
}

function emitter(listener: StageListener) {
  return (stage: Stage, status: StageStatus, detail: string | null = null) =>
    listener({ stage, status, detail })
}

// normalize → reference date → instructions → classify → extract (in parallel) → validate → merge → prioritize
export async function runPipeline(
  workspace: Workspace,
  request: PipelineRequest,
  extractor: Extractor,
  onStage: StageListener,
  options: RunOptions = {},
): Promise<PipelineResult> {
  const emit = emitter(onStage)
  const now = options.now ?? new Date()

  emit('normalize', 'running')
  const text = normalizeText(request.text)
  if (text.length === 0) {
    emit('normalize', 'failed', 'הטקסט ריק')
    throw new ValidationError('הטקסט ריק')
  }
  emit('normalize', 'done')

  emit('detectReferenceDate', 'running')
  const reference = detectReferenceDate(text, request.userReferenceDate, now)
  const originLabel = { text: 'מהטקסט', user: 'לפי בחירה', today: 'התאריך היום בישראל' }[reference.origin]
  emit('detectReferenceDate', 'done', `${reference.date} (${originLabel})`)

  // The board keeps the last date a text or a user declared; a message with no date of its own
  // must not move today's board to the real clock. "Tomorrow" means tomorrow on that board.
  // A board that followed the real clock keeps following it, so only a date a text or a person declared is kept.
  const keepsReference =
    reference.origin === 'today' && workspace.referenceDate !== null && workspace.referenceDateOrigin !== 'today'
  const boardDate = keepsReference ? (workspace.referenceDate as string) : reference.date

  const inputId = randomUUID()
  const context = { inputId, text, now }

  // Instructions first: a sentence like "the meeting moved to 11:00" changes an existing item and
  // must not also be read as a new meeting.
  emit('extractCommands', 'running')
  let commandSignals
  try {
    commandSignals = await extractor.extractCommands({ text })
  } catch (error) {
    emit('extractCommands', 'failed', error instanceof Error ? error.message : 'שגיאה לא ידועה')
    throw error
  }
  const parsedCommands = commandSignals.map((signal) => parseCommand(context, signal, boardDate))
  // Sentences that were really instructions are kept away from the agents that read information.
  const handled = commandSignals.flatMap((signal, index) => {
    const parsed = parsedCommands[index]
    if (!parsed.ok && parsed.ignored) return []
    const match = findQuote(text, normalizeText(signal.quote))
    return match ? [match] : []
  })
  const applied = applyCommands(workspace, parsedCommands)
  const instructions = parsedCommands.filter((parsed) => parsed.ok || !parsed.ignored).length
  emit('extractCommands', 'done', instructions === 0 ? 'אין הוראות' : `${instructions} הוראות`)

  const remaining = removeRanges(text, handled)

  emit('classify', 'running')
  const segments = classify(remaining)
  const routed = routeSegments(segments)
  emit('classify', 'done', segments.length === 0 ? 'אין מידע חדש לקרוא' : describeSegments(segments))

  const stageRun = async <T>(stage: Stage, input: string, run: () => Promise<T>, count: (result: T) => string) => {
    if (input.length === 0) {
      emit(stage, 'skipped', 'אין קטע רלוונטי בטקסט')
      return null
    }
    emit(stage, 'running')
    try {
      const result = await run()
      emit(stage, 'done', count(result))
      return result
    } catch (error) {
      emit(stage, 'failed', error instanceof Error ? error.message : 'שגיאה לא ידועה')
      throw error
    }
  }

  const [briefSignals, taskSignals, meetingSignals] = await Promise.all([
    stageRun('extractBrief', routed.brief, () => extractor.extractBrief({ text: routed.brief }), (r) =>
      r.length > 0 ? `${r.length} בריפים` : 'אין בריף',
    ),
    stageRun('extractTasks', routed.tasks, () => extractor.extractTasks({ text: routed.tasks }), (r) => `${r.length} משימות`),
    stageRun('extractMeetings', routed.meetings, () => extractor.extractMeetings({ text: routed.meetings }), (r) => `${r.length} פגישות`),
  ])

  emit('validate', 'running')
  const briefs = briefSignals ? buildBriefs(context, briefSignals, boardDate) : []
  const allTasks = taskSignals ? buildTasks(context, taskSignals, boardDate) : []
  const allMeetings = meetingSignals ? buildMeetings(context, meetingSignals, boardDate) : []
  const { tasks, meetings, droppedMeetings, droppedTasks } = collapseOverlappingClaims(allMeetings, allTasks)
  const droppedNotes = [
    droppedTasks > 0 && `${droppedTasks} משימות שחזרו על פגישה אוחדו`,
    droppedMeetings > 0 && `${droppedMeetings} "פגישות" שהיו בעצם משימות הוסרו`,
  ].filter(Boolean)
  emit('validate', 'done', [`${tasks.length} משימות, ${meetings.length} פגישות`, ...droppedNotes].join(', '))

  emit('merge', 'running')
  const extraction: Extraction = { briefs, tasks, meetings }
  const merged = mergeExtraction(applied.workspace, extraction, text)
  const withSource: Workspace = {
    ...merged,
    referenceDate: keepsReference ? workspace.referenceDate : reference.date,
    referenceDateOrigin: keepsReference ? workspace.referenceDateOrigin : reference.origin,
    sources: [
      ...merged.sources,
      {
        id: inputId,
        text,
        addedAt: now.toISOString(),
        referenceDate: reference.date,
        referenceDateOrigin: reference.origin,
      },
    ],
    updatedAt: now.toISOString(),
  }
  emit('merge', 'done', `${merged.contradictions.length - workspace.contradictions.length} סתירות חדשות`)

  emit('prioritize', 'running')
  const result = recompute(withSource, now)
  emit('prioritize', 'done', `${result.questions.length} שאלות פתוחות`)

  const added = [...describeAdded(result, tasks, meetings, briefs), ...describeSkipped(result, tasks, meetings)]
  const parts = [...applied.labels, ...added]
  return {
    workspace: result,
    commandResults: applied.results,
    label: parts.length > 0 ? parts.join(' · ') : 'ההודעה נקראה, אבל לא זוהו בה משימות, פגישות, בריף או הוראות',
  }
}

const columnNames: Record<Bucket, string> = { today: 'היום', tomorrow: 'מחר', week: 'השבוע הקרוב', later: 'בהמשך' }

// What was added and where it landed, so a person who typed a line can see what happened to it.
function describeAdded(result: Workspace, tasks: Task[], meetings: Meeting[], briefs: Brief[]): string[] {
  const parts: string[] = []
  const taskById = new Map(result.tasks.map((task) => [task.id, task]))
  const meetingById = new Map(result.meetings.map((meeting) => [meeting.id, meeting]))
  const briefById = new Map(result.briefs.map((brief) => [brief.id, brief]))

  for (const fresh of tasks) {
    const task = taskById.get(fresh.id)
    if (!task) continue
    const place = task.blocked ? 'ממתין (חסומה)' : columnNames[task.bucket]
    const hour = task.deadline.time ? `, עד ${task.deadline.time}` : ''
    parts.push(`נוספה משימה "${task.title}" ← ${place}${hour}`)
  }
  for (const fresh of meetings) {
    const meeting = meetingById.get(fresh.id)
    if (!meeting) continue
    const when = [meeting.date.value, meeting.startTime.value].filter(Boolean).join(' ')
    parts.push(`נוספה פגישה "${meeting.topic}"${when ? ` ← ${when}` : ' ← ממתינה לתיאום'}`)
  }
  // A brief text that only enriched an existing card (matched by client/campaign/message) says
  // nothing extra here, the same as a task or meeting that merely filled a gap in a known one.
  for (const fresh of briefs) {
    const brief = briefById.get(fresh.id)
    if (!brief) continue
    const name = brief.fields.client.value ?? brief.fields.campaign.value
    parts.push(`נוסף בריף${name ? ` "${name}"` : ''}`)
  }
  return parts
}

// Cards the text mentioned that were not added, and why: the message was understood, so it must not look ignored.
function describeSkipped(result: Workspace, tasks: Task[], meetings: Meeting[]): string[] {
  const parts: string[] = []
  const inResult = new Set([...result.tasks.map((task) => task.id), ...result.meetings.map((meeting) => meeting.id)])
  // A live card with the same name is what the message repeated; a deleted one only if there is no live one.
  const known = (topic: string, list: { title?: string; topic?: string; deleted: boolean }[]) => {
    const same = list.filter((item) => (item.title ?? item.topic) === topic)
    return same.find((item) => !item.deleted) ?? same[0]
  }

  for (const fresh of tasks.filter((task) => !inResult.has(task.id))) {
    const twin = known(fresh.title, result.tasks)
    parts.push(
      twin?.deleted
        ? `משימה "${fresh.title}" נמחקה קודם, ולכן לא נוספה שוב (אפשר לשחזר אותה מ"נמחקו")`
        : `משימה "${fresh.title}" כבר קיימת, ולכן לא נוספה שוב`,
    )
  }
  for (const fresh of meetings.filter((meeting) => !inResult.has(meeting.id))) {
    const twin = known(fresh.topic, result.meetings)
    parts.push(
      twin?.deleted
        ? `פגישה "${fresh.topic}" נמחקה קודם, ולכן לא נוספה שוב (אפשר לשחזר אותה מ"נמחקו")`
        : `פגישה "${fresh.topic}" כבר קיימת, ולכן לא נוספה שוב`,
    )
  }
  return parts
}
