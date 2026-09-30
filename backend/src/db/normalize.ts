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

function normalizeBrief(brief: Loose): Loose {
  return {
    id: randomUUID(),
    ...brief,
    deliverables: asItems(brief.deliverables),
    constraints: asItems(brief.constraints),
    suggestions: asItems(brief.suggestions),
    missingDetails: asItems(brief.missingDetails),
  }
}

// Older rows stored one `brief` object (or none); a workspace now holds a list of them.
function asBriefs(state: Loose): unknown[] {
  if (Array.isArray(state.briefs)) return state.briefs.map((brief) => normalizeBrief(brief as Loose))
  const single = state.brief as Loose | null
  return single ? [normalizeBrief(single)] : []
}

// Rows written by an earlier shape of the app are upgraded on load, so no stored workspace is lost.
export function normalizeStoredWorkspace(raw: unknown): Workspace | null {
  const state = raw as Loose | null
  if (!state || typeof state.id !== 'string') return null

  const normalized = { ...state } as Loose
  delete normalized.brief

  return {
    ...(normalized as unknown as Workspace),
    tasks: ((state.tasks as Loose[]) ?? []).map((task) => ({
      deleted: false,
      meetingLink: null,
      deadline: { date: null, time: null, meetingId: null },
      ...task,
      signals: { dayPart: null, ...(task.signals as object) },
    })) as Workspace['tasks'],
    meetings: ((state.meetings as Loose[]) ?? []).map((meeting) => ({ deleted: false, dayPart: null, ...meeting })) as Workspace['meetings'],
    briefs: asBriefs(state) as Workspace['briefs'],
    // A contradiction on a brief field from before briefs had ids has nothing to point at; drop it
    // rather than carry a target the rest of the code can no longer resolve.
    contradictions: ((state.contradictions as Workspace['contradictions']) ?? []).filter(
      (item) => item.target.type !== 'brief' || 'briefId' in item.target,
    ),
    dismissedQuestionIds: (state.dismissedQuestionIds as string[]) ?? [],
    cardOrder: (state.cardOrder as string[]) ?? [],
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
