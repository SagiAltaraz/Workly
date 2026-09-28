import { readFile } from 'node:fs/promises'
import pg from 'pg'
import { env } from '../config/env'

export const pool = new pg.Pool({ connectionString: env.databaseUrl })

export async function initDatabase(): Promise<void> {
  const schema = await readFile(new URL('./schema.sql', import.meta.url), 'utf8')
  await pool.query(schema)
}
