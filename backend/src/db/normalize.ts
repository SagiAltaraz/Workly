import { randomUUID } from 'node:crypto'
import type { Workspace } from '../types/workspace'
import type { Snapshot } from '../services/history'

type Loose = Record<string, unknown>

function asItems(list: unknown): unknown[] {
  if (!Array.isArray(list)) return []
  // Older rows stored a plain list of fields; each entry is now a field with an id.
  return list.map((entry) => {
    const record = entry as Loose
    return 'field' in record ? record : { id: randomUUID(), field: entry, deleted: false }
  })
}

// Rows written by an earlier shape of the app are upgraded on load, so no stored workspace is lost.
export function normalizeStoredWorkspace(raw: unknown): Workspace | null {
  const state = raw as Loose | null
  if (!state || typeof state.id !== 'string') return null

  const brief = state.brief as Loose | null
  return {
    ...(state as unknown as Workspace),
    tasks: ((state.tasks as Loose[]) ?? []).map((task) => ({ deleted: false, ...task })) as Workspace['tasks'],
    meetings: ((state.meetings as Loose[]) ?? []).map((meeting) => ({ deleted: false, ...meeting })) as Workspace['meetings'],
    brief: brief
      ? ({
          ...brief,
          deliverables: asItems(brief.deliverables),
          constraints: asItems(brief.constraints),
          suggestions: asItems(brief.suggestions),
          missingDetails: asItems(brief.missingDetails),
        } as unknown as Workspace['brief'])
      : null,
    contradictions: (state.contradictions as Workspace['contradictions']) ?? [],
    dismissedQuestionIds: (state.dismissedQuestionIds as string[]) ?? [],
    activity: (state.activity as Workspace['activity']) ?? [],
    questions: (state.questions as Workspace['questions']) ?? [],
  }
}

export function normalizeStoredHistory(raw: unknown): Snapshot[] {
  if (!Array.isArray(raw)) return []
  return raw.flatMap((entry) => {
    const workspace = normalizeStoredWorkspace((entry as Loose)?.workspace)
    return workspace ? [{ activityId: String((entry as Loose).activityId), workspace }] : []
  })
}
