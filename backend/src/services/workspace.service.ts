import { randomUUID } from 'node:crypto'
import * as workspaceRepository from '../db/workspace.repository'
import type { StoredWorkspace } from '../db/workspace.repository'
import { NotFoundError, ValidationError } from '../errors'
import type { Change } from '../pipeline/edits'
import type { Workspace } from '../types/workspace'
import { recordChange, undoLastChange } from './history'

// Reads and writes hit this map, so requests never wait on the database. Every change is
// written to Postgres right after, and the map is refilled from Postgres on startup.
const cache = new Map<string, StoredWorkspace>()
const writeChains = new Map<string, Promise<void>>()
const locks = new Map<string, Promise<unknown>>()

export async function hydrateWorkspaces(): Promise<number> {
  const stored = await workspaceRepository.loadAllWorkspaces()
  for (const entry of stored) cache.set(entry.workspace.id, entry)
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

export function createWorkspace(now: Date = new Date()): Workspace {
  const timestamp = now.toISOString()
  const workspace: Workspace = {
    id: randomUUID(),
    createdAt: timestamp,
    updatedAt: timestamp,
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
  persist({ workspace, history: [] })
  return workspace
}

export function getWorkspace(id: string): Workspace | undefined {
  return cache.get(id)?.workspace
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
    const change = await apply(stored.workspace)
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
