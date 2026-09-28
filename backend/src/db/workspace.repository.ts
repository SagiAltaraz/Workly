import type { Snapshot } from '../services/history'
import type { Workspace } from '../types/workspace'
import { normalizeStoredHistory, normalizeStoredWorkspace } from './normalize'
import { pool } from './pool'

interface WorkspaceRow {
  state: unknown
  history: unknown
}

export interface StoredWorkspace {
  workspace: Workspace
  history: Snapshot[]
}

export async function upsertWorkspace(stored: StoredWorkspace): Promise<void> {
  const { workspace, history } = stored
  await pool.query(
    `INSERT INTO workspaces (id, state, history, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (id) DO UPDATE
       SET state = EXCLUDED.state, history = EXCLUDED.history, updated_at = EXCLUDED.updated_at`,
    [workspace.id, JSON.stringify(workspace), JSON.stringify(history), workspace.createdAt, workspace.updatedAt],
  )
}

export async function loadAllWorkspaces(): Promise<StoredWorkspace[]> {
  const { rows } = await pool.query<WorkspaceRow>('SELECT state, history FROM workspaces')
  return rows.flatMap((row) => {
    const workspace = normalizeStoredWorkspace(row.state)
    return workspace ? [{ workspace, history: normalizeStoredHistory(row.history) }] : []
  })
}
