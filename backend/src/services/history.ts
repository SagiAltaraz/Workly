import { randomUUID } from 'node:crypto'
import type { Workspace } from '../types/workspace'

// The state as it was right before one change, so that change can be undone.
export interface Snapshot {
  activityId: string
  workspace: Workspace
}

export const maxSnapshots = 10
const maxActivity = 30

export interface Recorded {
  workspace: Workspace
  history: Snapshot[]
}

// Pure on purpose: what "a change" does to the activity list and the undo stack is testable
// without a database.
export function recordChange(
  before: Workspace,
  after: Workspace,
  history: Snapshot[],
  label: string,
  now: Date,
): Recorded {
  const entry = { id: randomUUID(), label, at: now.toISOString() }
  return {
    workspace: { ...after, updatedAt: entry.at, activity: [...before.activity, entry].slice(-maxActivity) },
    history: [...history, { activityId: entry.id, workspace: before }].slice(-maxSnapshots),
  }
}

export interface Undone extends Recorded {
  undoneLabel: string
}

export function undoLastChange(current: Workspace, history: Snapshot[], now: Date): Undone | null {
  const last = history.at(-1)
  if (!last) return null
  const undoneLabel = current.activity.find((entry) => entry.id === last.activityId)?.label ?? 'הפעולה האחרונה'
  return {
    workspace: { ...last.workspace, updatedAt: now.toISOString() },
    history: history.slice(0, -1),
    undoneLabel,
  }
}
