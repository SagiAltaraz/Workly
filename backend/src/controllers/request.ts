import type { Response } from 'express'
import type { z } from 'zod'
import { ValidationError } from '../errors'
import type { Change } from '../pipeline/edits'
import * as workspaceService from '../services/workspace.service'
import type { ApiResponse } from '../types/api'
import type { Workspace } from '../types/workspace'
import { sendOk } from './respond'

export function parseBody<T>(schema: z.ZodType<T>, body: unknown): T {
  const parsed = schema.safeParse(body)
  if (!parsed.success) throw new ValidationError('גוף הבקשה אינו תקין')
  return parsed.data
}

// Runs an edit through the single door for changes and answers with the new state.
export async function respondWithChange(
  res: Response<ApiResponse<Workspace>>,
  workspaceId: string,
  apply: (workspace: Workspace) => Change,
  status = 200,
): Promise<void> {
  sendOk(res, await workspaceService.applyChange(workspaceId, apply), status)
}
