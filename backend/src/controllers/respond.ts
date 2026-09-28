import type { Response } from 'express'
import { NoModelConfiguredError, NotFoundError, ValidationError } from '../errors'
import type { ApiResponse } from '../types/api'

export function sendOk<T>(res: Response<ApiResponse<T>>, data: T, status = 200): void {
  res.status(status).json({ ok: true, data })
}

// Maps a thrown error to the one response shape every endpoint uses.
export function sendError(res: Response<ApiResponse<never>>, error: unknown): void {
  if (error instanceof NotFoundError) {
    res.status(404).json({ ok: false, error: error.message })
  } else if (error instanceof ValidationError) {
    res.status(400).json({ ok: false, error: error.message })
  } else if (error instanceof NoModelConfiguredError) {
    res.status(503).json({ ok: false, error: error.message })
  } else {
    console.error('unexpected error', error)
    res.status(500).json({ ok: false, error: 'שגיאה פנימית בשרת' })
  }
}
