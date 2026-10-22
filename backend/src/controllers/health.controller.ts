import type { Request, Response } from 'express'
import { isDatabaseReady, pool } from '../db/pool'
import { extractor } from '../services/extractor.service'
import type { ApiResponse } from '../types/api'
import { sendError, sendOk } from './respond'

interface HealthData {
  status: 'up'
  modelConfigured: boolean
}

export async function getHealth(_req: Request, res: Response<ApiResponse<HealthData>>) {
  try {
    // Without a database the app runs from memory, which is still "up".
    if (isDatabaseReady()) await pool.query('SELECT 1')
    sendOk(res, { status: 'up', modelConfigured: extractor !== null })
  } catch (error) {
    sendError(res, error)
  }
}
