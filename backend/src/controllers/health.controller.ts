import type { Request, Response } from 'express'
import { pool } from '../db/pool'
import { extractor } from '../services/extractor.service'
import type { ApiResponse } from '../types/api'
import { sendError, sendOk } from './respond'

interface HealthData {
  status: 'up'
  modelConfigured: boolean
}

export async function getHealth(_req: Request, res: Response<ApiResponse<HealthData>>) {
  try {
    await pool.query('SELECT 1')
    sendOk(res, { status: 'up', modelConfigured: extractor !== null })
  } catch (error) {
    sendError(res, error)
  }
}
