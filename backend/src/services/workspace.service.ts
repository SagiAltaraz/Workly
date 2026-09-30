import { randomUUID } from 'node:crypto'
import * as workspaceRepository from '../db/workspace.repository'
import type { StoredWorkspace } from '../db/workspace.repository'
import { NotFoundError, ValidationError } from '../errors'
import type { Change } from '../pipeline/edits'
import { advanceDay } from '../pipeline/advanceDay'
import { backfillDays } from '../pipeline/backfill'
import { recompute } from '../pipeline/recompute'
import type { Workspace } from '../types/workspace'
import { recordChange, undoLastChange } from './history'

// Reads and writes hit this map, so requests never wait on the database. Every change is
// written to Postgres right after, and the map is refilled from Postgres on startup.
const cache = new Map<string, StoredWorkspace>()
const writeChains = new Map<string, Promise<void>>()
const locks = new Map<string, Promise<unknown>>()

export async function hydrateWorkspaces(): Promise<number> {
  const stored = await workspaceRepository.loadAllWorkspaces()
  // Everything derived is recomputed on load, so a workspace saved by an older version shows the
  // current buckets, deadlines and questions.
  for (const entry of stored) {
    const repaired = recompute(backfillDays(entry.workspace))
    cache.set(entry.workspace.id, { ...entry, workspace: advanceDay(repaired, new Date())?.workspace ?? repaired })
  }
  return stored.length
}

function persist(stored: StoredWorkspace): void {
  cache.set(stored.workspace.id, stored)
  const id = stored.workspace.id
  const previous = writeChains.get(id) ?? Promise.resolve()
  const next = previous
    .then(() => workspaceRepository.upsertWorkspace(stored))
    .catch((error) => console.error(`failed to persist workspace ${id}`, error))
  writeChains.set(id, next)
}

function blankWorkspace(id: string, now: Date): Workspace {
  const timestamp = now.toISOString()
  return {
    id,
    createdAt: timestamp,
    updatedAt: timestamp,
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

export function createWorkspace(now: Date = new Date()): Workspace {
  const workspace = blankWorkspace(randomUUID(), now)
  persist({ workspace, history: [] })
  return workspace
}

export function getWorkspace(id: string): Workspace | undefined {
  return cache.get(id)?.workspace
}

// Like createWorkspace, but for a caller that needs a specific, stable id (the demo workspace):
// returns the existing one if there already is one, otherwise starts a blank one at that id.
export function getOrCreateWorkspace(id: string, now: Date = new Date()): Workspace {
  const existing = getWorkspace(id)
  if (existing) return existing
  const workspace = blankWorkspace(id, now)
  persist({ workspace, history: [] })
  return workspace
}

// What a person sees when opening the app. If the day has changed since the last visit, the board moves
// on first: unfinished tasks of earlier days are for today, and that is written down and can be undone.
export function getFreshWorkspace(id: string): Promise<Workspace> {
  return runExclusive(id, async () => {
    const stored = requireStored(id)
    const now = new Date()
    const advanced = advanceDay(stored.workspace, now)
    if (!advanced) return stored.workspace
    if (advanced.label === null) {
      persist({ ...stored, workspace: advanced.workspace })
      return advanced.workspace
    }
    const recorded = recordChange(stored.workspace, advanced.workspace, stored.history, advanced.label, now)
    persist(recorded)
    return recorded.workspace
  })
}

function requireStored(id: string): StoredWorkspace {
  const stored = cache.get(id)
  if (!stored) throw new NotFoundError('ה-workspace לא נמצא')
  return stored
}

// One change at a time per workspace, so two changes never build on a stale state.
function runExclusive<T>(id: string, task: () => Promise<T>): Promise<T> {
  const previous = locks.get(id) ?? Promise.resolve()
  const run = previous.then(task, task)
  locks.set(
    id,
    run.catch(() => undefined),
  )
  return run
}

// The single door for every change, from a card, from the chat or from a pasted text: it runs the
// edit, records what happened for the activity line and keeps the state to undo it. If the edit
// throws, nothing is saved.
export function applyChange(id: string, apply: (workspace: Workspace) => Change | Promise<Change>): Promise<Workspace> {
  return runExclusive(id, async () => {
    const stored = requireStored(id)
    // A change made on a new day starts from a board that has already moved on.
    const current = advanceDay(stored.workspace, new Date())?.workspace ?? stored.workspace
    const change = await apply(current)
    const recorded = recordChange(stored.workspace, change.workspace, stored.history, change.label, new Date())
    persist(recorded)
    return recorded.workspace
  })
}

export function undoLast(id: string): Promise<{ workspace: Workspace; undoneLabel: string }> {
  return runExclusive(id, async () => {
    const stored = requireStored(id)
    const undone = undoLastChange(stored.workspace, stored.history, new Date())
    if (!undone) throw new ValidationError('אין פעולה לבטל')
    persist(undone)
    return { workspace: undone.workspace, undoneLabel: undone.undoneLabel }
  })
}

export async function flushWrites(): Promise<void> {
  await Promise.all(writeChains.values())
}
