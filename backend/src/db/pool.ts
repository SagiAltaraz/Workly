import { readFile } from 'node:fs/promises'
import pg from 'pg'
import { env } from '../config/env'

export const pool = new pg.Pool({ connectionString: env.databaseUrl })

let ready = false

export function isDatabaseReady(): boolean {
  return ready
}

interface NetworkError {
  code?: string
  // Node reports one error per address tried (IPv6, then IPv4) inside an AggregateError.
  errors?: { code?: string }[]
}

// Only "nobody is listening" falls back to memory; a wrong password or a broken schema still stops the server.
function isUnreachable(error: unknown): boolean {
  const { code, errors } = error as NetworkError
  return [code, ...(errors ?? []).map((item) => item.code)].some((value) => value === 'ECONNREFUSED' || value === 'ENOTFOUND')
}

// The database is optional: without it the app still runs, keeping workspaces in memory only.
// Returns whether the database is in use.
export async function initDatabase(): Promise<boolean> {
  try {
    const schema = await readFile(new URL('./schema.sql', import.meta.url), 'utf8')
    await pool.query(schema)
    ready = true
  } catch (error) {
    if (!isUnreachable(error)) throw error
    await pool.end().catch(() => undefined)
  }
  return ready
}
