import type { Request, Response } from 'express'
import { env } from '../config/env'
import { pool } from '../db/pool'
import type { ApiResponse } from '../types/api'

interface HealthData {
  status: 'up'
  demoMode: boolean
}

export async function getHealth(_req: Request, res: Response<ApiResponse<HealthData>>) {
  try {
    await pool.query('SELECT 1')
    res.status(200).json({ ok: true, data: { status: 'up', demoMode: env.demoMode } })
  } catch (error) {
    console.error('health check failed', error)
    res.status(503).json({ ok: false, error: 'Database is not reachable' })
  }
}
