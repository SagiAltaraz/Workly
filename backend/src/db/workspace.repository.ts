import { pool } from './pool'

export interface WorkspaceRecord {
  id: string
  state: Record<string, unknown>
  updatedAt: string
}

interface WorkspaceRow {
  id: string
  state: Record<string, unknown>
  updated_at: Date
}

function toRecord(row: WorkspaceRow): WorkspaceRecord {
  return { id: row.id, state: row.state, updatedAt: row.updated_at.toISOString() }
}

export async function createWorkspace(): Promise<WorkspaceRecord> {
  const { rows } = await pool.query<WorkspaceRow>(
    'INSERT INTO workspaces DEFAULT VALUES RETURNING id, state, updated_at',
  )
  return toRecord(rows[0])
}

export async function findWorkspace(id: string): Promise<WorkspaceRecord | null> {
  const { rows } = await pool.query<WorkspaceRow>(
    'SELECT id, state, updated_at FROM workspaces WHERE id = $1',
    [id],
  )
  return rows[0] ? toRecord(rows[0]) : null
}
