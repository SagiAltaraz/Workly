import type { Request, Response } from 'express'
import { z } from 'zod'
import { dismissQuestion, resolveContradiction } from '../pipeline/edits'
import type { ApiResponse } from '../types/api'
import type { Workspace } from '../types/workspace'
import { parseBody, respondWithChange } from './request'
import { sendError } from './respond'

type WorkspaceResponse = Response<ApiResponse<Workspace>>

const resolveSchema = z.object({ choice: z.enum(['keepExisting', 'useIncoming']) })

export async function resolveOpenContradiction(
  req: Request<{ id: string; contradictionId: string }>,
  res: WorkspaceResponse,
) {
  try {
    const body = parseBody(resolveSchema, req.body)
    await respondWithChange(res, req.params.id, (workspace) =>
      resolveContradiction(workspace, req.params.contradictionId, body.choice),
    )
  } catch (error) {
    sendError(res, error)
  }
}

export async function hideQuestion(req: Request<{ id: string; questionId: string }>, res: WorkspaceResponse) {
  try {
    await respondWithChange(res, req.params.id, (workspace) => dismissQuestion(workspace, req.params.questionId))
  } catch (error) {
    sendError(res, error)
  }
}
