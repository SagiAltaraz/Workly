import type { CommandSignal } from '../src/agents/commands/commands.schema'
import type { Extractor } from '../src/agents/extractor'
import type { Brief, BriefFieldKey } from '../src/types/brief'
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
  dayPart: null,
}

interface TaskOptions {
  title?: string
  quote?: string
  dueDate?: string | null
  dueTime?: string | null
  signals?: Partial<TaskSignals>
  // The words that tie the task to a meeting, e.g. "לפגישה עם שגיא".
  meetingPhrase?: string
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
    meetingLink: options.meetingPhrase ? { phrase: options.meetingPhrase, meetingId: null } : null,
    deadline: { date: null, time: null, meetingId: null },
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
    dayPart: null,
    awaitingScheduling: false,
    weekdayMismatch: false,
    conflictsWith: [],
    deleted: false,
  }
}

const emptyBriefFieldKeys: BriefFieldKey[] = ['client', 'campaign', 'message', 'audience', 'tone', 'deadline', 'launchDate']

interface BriefOptions {
  id?: string
  client?: string
  campaign?: string
  message?: string
}

export function makeBrief(options: BriefOptions = {}): Brief {
  const fields = Object.fromEntries(emptyBriefFieldKeys.map((key) => [key, field(null)])) as Brief['fields']
  if (options.client) fields.client = field(options.client)
  if (options.campaign) fields.campaign = field(options.campaign)
  if (options.message) fields.message = field(options.message)
  return {
    id: options.id ?? options.client ?? options.campaign ?? 'brief',
    fields,
    deliverables: [],
    constraints: [],
    suggestions: [],
    missingDetails: [],
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
    briefs: [],
    tasks: [],
    meetings: [],
    contradictions: [],
    dismissedQuestionIds: [],
    cardOrder: [],
    activity: [],
    questions: [],
  }
}

// Fixed answers instead of a model: the whole deterministic pipeline runs for real.
export function stubExtractor(parts: Partial<Extractor> = {}): Extractor {
  return {
    extractCommands: async () => [],
    extractBrief: async () => [],
    extractTasks: async () => [],
    extractMeetings: async () => [],
    ...parts,
  }
}

export function commandSignal(overrides: Partial<CommandSignal> & Pick<CommandSignal, 'action' | 'quote'>): CommandSignal {
  return { targetText: null, title: null, dateText: null, timeText: null, participants: [], ...overrides }
}
