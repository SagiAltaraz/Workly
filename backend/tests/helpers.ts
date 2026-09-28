import type { CommandSignal } from '../src/agents/commands/commands.schema'
import type { Extractor } from '../src/agents/extractor'
import type { Meeting } from '../src/types/meeting'
import type { Field } from '../src/types/provenance'
import type { Task, TaskSignals } from '../src/types/task'
import type { Workspace } from '../src/types/workspace'

export function field(value: string | null, overrides: Partial<Field> = {}): Field {
  return {
    value,
    status: value === null ? 'missing' : 'stated',
    quote: null,
    span: null,
    verified: value !== null,
    editedByUser: false,
    note: null,
    ...overrides,
  }
}

export const noSignals: TaskSignals = {
  urgency: null,
  externalWaiting: null,
  blocksOthers: null,
  condition: null,
  canWait: null,
  notUrgent: null,
  listedUnder: null,
}

interface TaskOptions {
  title?: string
  quote?: string
  dueDate?: string | null
  dueTime?: string | null
  signals?: Partial<TaskSignals>
}

export function makeTask(options: TaskOptions = {}): Task {
  const quote = options.quote ?? options.title ?? 'משימה'
  return {
    id: options.title ?? quote,
    title: options.title ?? quote,
    quote: field(quote),
    dueDate: field(options.dueDate ?? null),
    dueTime: field(options.dueTime ?? null),
    signals: { ...noSignals, ...options.signals },
    done: false,
    deleted: false,
    blocked: false,
    bucket: 'later',
    priority: null,
    rule: 'p4Later',
    reason: '',
  }
}

interface MeetingOptions {
  id?: string
  topic?: string
  quote?: string
  weekdayWritten?: string | null
  date?: string | null
  start?: string | null
  end?: string | null
}

export function makeMeeting(options: MeetingOptions = {}): Meeting {
  const topic = options.topic ?? 'פגישה'
  return {
    id: options.id ?? topic,
    topic,
    quote: field(options.quote ?? topic),
    weekdayWritten: options.weekdayWritten ?? null,
    date: field(options.date ?? null),
    startTime: field(options.start ?? null),
    endTime: field(options.end ?? null),
    participants: [],
    awaitingScheduling: false,
    weekdayMismatch: false,
    conflictsWith: [],
    deleted: false,
  }
}

export function emptyWorkspace(): Workspace {
  return {
    id: 'ws',
    createdAt: '2026-09-23T00:00:00.000Z',
    updatedAt: '2026-09-23T00:00:00.000Z',
    referenceDate: null,
    referenceDateOrigin: null,
    sources: [],
    brief: null,
    tasks: [],
    meetings: [],
    contradictions: [],
    dismissedQuestionIds: [],
    activity: [],
    questions: [],
  }
}

export const emptyBriefSignals = {
  containsBrief: false,
  client: null,
  campaign: null,
  message: null,
  audience: null,
  tone: null,
  deadline: null,
  launchDate: null,
  deliverables: [],
  constraints: [],
  suggestions: [],
  missingDetails: [],
}

// Fixed answers instead of a model: the whole deterministic pipeline runs for real.
export function stubExtractor(parts: Partial<Extractor> = {}): Extractor {
  return {
    extractCommands: async () => [],
    extractBrief: async () => emptyBriefSignals,
    extractTasks: async () => [],
    extractMeetings: async () => [],
    ...parts,
  }
}

export function commandSignal(overrides: Partial<CommandSignal> & Pick<CommandSignal, 'action' | 'quote'>): CommandSignal {
  return { targetText: null, title: null, dateText: null, timeText: null, participants: [], ...overrides }
}
