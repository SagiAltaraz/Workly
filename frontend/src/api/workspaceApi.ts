import type { AnalyzeEvent, ApiResponse } from '../types/api'
import type { BriefFieldKey } from '../types/brief'
import type { CommandResult, ResolvedCommand } from '../types/command'
import type { Stage, StageEvent } from '../types/pipeline'
import type { Workspace } from '../types/workspace'

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(path, init)
  } catch {
    throw new ApiError('אין חיבור לשרת', 0)
  }
  const body = (await response.json()) as ApiResponse<T>
  if (!body.ok) throw new ApiError(body.error, response.status)
  return body.data
}

function jsonInit(method: string, body?: unknown): RequestInit {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  }
}

export interface Health {
  status: 'up'
  modelConfigured: boolean
}

export interface NewTask {
  title: string
  listedUnder: 'today' | 'week'
  dueDate?: string | null
  dueTime?: string | null
}

// null clears a value; leaving a key out leaves it alone.
export interface TaskPatch {
  title?: string
  done?: boolean
  dueDate?: string | null
  dueTime?: string | null
  conditionResolved?: true
}

export interface NewMeeting {
  topic: string
  date: string | null
  startTime: string | null
  endTime: string | null
  participants: string[]
}

export interface MeetingPatch {
  topic?: string
  participants?: string[]
  date?: string | null
  startTime?: string | null
  endTime?: string | null
}

export interface AnalyzeOutcome {
  workspace: Workspace
  commandResults: CommandResult[]
}

const base = (id: string) => `/api/workspaces/${id}`

export const workspaceApi = {
  health: () => request<Health>('/api/health'),
  create: () => request<Workspace>('/api/workspaces', jsonInit('POST')),
  get: (id: string) => request<Workspace>(base(id)),
  undo: (id: string) => request<Workspace>(`${base(id)}/undo`, jsonInit('POST')),

  addTask: (id: string, task: NewTask) => request<Workspace>(`${base(id)}/tasks`, jsonInit('POST', task)),
  patchTask: (id: string, taskId: string, patch: TaskPatch) =>
    request<Workspace>(`${base(id)}/tasks/${taskId}`, jsonInit('PATCH', patch)),
  deleteTask: (id: string, taskId: string) => request<Workspace>(`${base(id)}/tasks/${taskId}`, jsonInit('DELETE')),
  restoreTask: (id: string, taskId: string) => request<Workspace>(`${base(id)}/tasks/${taskId}/restore`, jsonInit('POST')),

  addMeeting: (id: string, meeting: NewMeeting) => request<Workspace>(`${base(id)}/meetings`, jsonInit('POST', meeting)),
  patchMeeting: (id: string, meetingId: string, patch: MeetingPatch) =>
    request<Workspace>(`${base(id)}/meetings/${meetingId}`, jsonInit('PATCH', patch)),
  deleteMeeting: (id: string, meetingId: string) =>
    request<Workspace>(`${base(id)}/meetings/${meetingId}`, jsonInit('DELETE')),
  restoreMeeting: (id: string, meetingId: string) =>
    request<Workspace>(`${base(id)}/meetings/${meetingId}/restore`, jsonInit('POST')),

  patchBriefField: (id: string, key: BriefFieldKey, value: string | null) =>
    request<Workspace>(`${base(id)}/brief/fields/${key}`, jsonInit('PATCH', { value })),
  addBriefItem: (id: string, list: 'deliverables' | 'constraints', text: string) =>
    request<Workspace>(`${base(id)}/brief/items`, jsonInit('POST', { list, text })),
  editBriefItem: (id: string, itemId: string, text: string) =>
    request<Workspace>(`${base(id)}/brief/items/${itemId}`, jsonInit('PATCH', { text })),
  deleteBriefItem: (id: string, itemId: string) =>
    request<Workspace>(`${base(id)}/brief/items/${itemId}`, jsonInit('DELETE')),
  promoteSuggestion: (id: string, itemId: string, into: 'deliverables' | 'constraints') =>
    request<Workspace>(`${base(id)}/brief/items/${itemId}/promote`, jsonInit('POST', { into })),
  answerMissingDetail: (id: string, itemId: string, answer: string) =>
    request<Workspace>(`${base(id)}/brief/items/${itemId}/answer`, jsonInit('POST', { answer })),

  resolveContradiction: (id: string, contradictionId: string, choice: 'keepExisting' | 'useIncoming') =>
    request<Workspace>(
      `${base(id)}/contradictions/${encodeURIComponent(contradictionId)}/resolve`,
      jsonInit('POST', { choice }),
    ),
  dismissQuestion: (id: string, questionId: string) =>
    request<Workspace>(`${base(id)}/questions/${encodeURIComponent(questionId)}/dismiss`, jsonInit('POST')),

  // The second step of an instruction that named several possible items: the person chose one.
  executeCommand: (id: string, command: ResolvedCommand, targetId: string | null) =>
    request<Workspace>(`${base(id)}/commands/execute`, jsonInit('POST', { command, targetId })),

  // Reads the server-sent stream and reports every stage as it happens.
  async analyze(
    id: string,
    text: string,
    referenceDate: string | null,
    onStage: (event: StageEvent) => void,
  ): Promise<AnalyzeOutcome> {
    let response: Response
    try {
      response = await fetch(`/api/workspaces/${id}/analyze`, jsonInit('POST', { text, referenceDate }))
    } catch {
      throw new ApiError('אין חיבור לשרת', 0)
    }
    if (!response.ok || !response.body) {
      const body = (await response.json()) as ApiResponse<never>
      throw new ApiError(body.ok ? 'תשובה לא צפויה מהשרת' : body.error, response.status)
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let result: AnalyzeOutcome | null = null

    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const frames = buffer.split('\n\n')
      buffer = frames.pop() ?? ''
      for (const frame of frames) {
        const event = JSON.parse(frame.replace(/^data: /, '')) as AnalyzeEvent
        if (event.type === 'stage') onStage(event.event)
        else if (event.type === 'done') result = { workspace: event.workspace, commandResults: event.commandResults }
        else throw new ApiError(event.error, 500)
      }
    }
    if (!result) throw new ApiError('החילוץ נקטע לפני שהסתיים', 500)
    return result
  },
}

export type StageMap = Partial<Record<Stage, StageEvent>>
