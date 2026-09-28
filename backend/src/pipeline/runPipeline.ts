import { randomUUID } from 'node:crypto'
import type { Extractor } from '../agents/extractor'
import { ValidationError } from '../errors'
import type { CommandResult } from '../types/command'
import type { Stage, StageEvent, StageStatus } from '../types/pipeline'
import type { Workspace } from '../types/workspace'
import { buildBrief } from './buildBrief'
import { buildMeetings } from './buildMeetings'
import { buildTasks } from './buildTasks'
import { classify, describeSegments, routeSegments } from './classify'
import { applyCommands } from './commands/applyCommands'
import { parseCommand } from './commands/parseCommand'
import { dedupeMeetingsAgainstTasks } from './dedupe'
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
  const keepsReference = reference.origin === 'today' && workspace.referenceDate !== null
  const boardDate = keepsReference ? (workspace.referenceDate as string) : reference.date

  const inputId = randomUUID()
  const context = { inputId, text }

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
      r.containsBrief ? 'נמצא בריף' : 'אין בריף',
    ),
    stageRun('extractTasks', routed.tasks, () => extractor.extractTasks({ text: routed.tasks }), (r) => `${r.length} משימות`),
    stageRun('extractMeetings', routed.meetings, () => extractor.extractMeetings({ text: routed.meetings }), (r) => `${r.length} פגישות`),
  ])

  emit('validate', 'running')
  const brief = briefSignals ? buildBrief(context, briefSignals, boardDate) : null
  const tasks = taskSignals ? buildTasks(context, taskSignals, boardDate) : []
  const allMeetings = meetingSignals ? buildMeetings(context, meetingSignals, boardDate) : []
  const { kept: meetings, dropped } = dedupeMeetingsAgainstTasks(allMeetings, tasks)
  const droppedNote = dropped.length > 0 ? `, ${dropped.length} פגישות כפולות למשימות אוחדו` : ''
  emit('validate', 'done', `${tasks.length} משימות, ${meetings.length} פגישות${droppedNote}`)

  emit('merge', 'running')
  const extraction: Extraction = { brief, tasks, meetings }
  const merged = mergeExtraction(applied.workspace, extraction)
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

  const foundInformation = tasks.length + meetings.length > 0 || brief !== null
  const infoLabel = foundInformation
    ? `נוסף מידע מהטקסט: ${[brief && 'בריף', tasks.length > 0 && `${tasks.length} משימות`, meetings.length > 0 && `${meetings.length} פגישות`].filter(Boolean).join(', ')}`
    : null
  const parts = [...applied.labels, ...(infoLabel ? [infoLabel] : [])]
  return {
    workspace: result,
    commandResults: applied.results,
    label: parts.length > 0 ? parts.join(' · ') : 'נוסף טקסט',
  }
}
