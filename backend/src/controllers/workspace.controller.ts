import type { Request, Response } from 'express'
import { z } from 'zod'
import { NotFoundError } from '../errors'
import { setCardOrder } from '../pipeline/edits'
import * as workspaceService from '../services/workspace.service'
import type { ApiResponse } from '../types/api'
import type { Workspace } from '../types/workspace'
import { parseBody, respondWithChange } from './request'
import { sendError, sendOk } from './respond'

type WorkspaceResponse = Response<ApiResponse<Workspace>>

export async function createWorkspace(_req: Request, res: WorkspaceResponse) {
  try {
    sendOk(res, workspaceService.createWorkspace(), 201)
  } catch (error) {
    sendError(res, error)
  }
}

export async function getWorkspace(req: Request<{ id: string }>, res: WorkspaceResponse) {
  try {
    if (!workspaceService.getWorkspace(req.params.id)) throw new NotFoundError('ה-workspace לא נמצא')
    sendOk(res, await workspaceService.getFreshWorkspace(req.params.id))
  } catch (error) {
    sendError(res, error)
  }
}

export async function undoLastChange(req: Request<{ id: string }>, res: WorkspaceResponse) {
  try {
    sendOk(res, (await workspaceService.undoLast(req.params.id)).workspace)
  } catch (error) {
    sendError(res, error)
  }
}

const cardOrderSchema = z.object({ ids: z.array(z.string()).max(500) })

export async function updateCardOrder(req: Request<{ id: string }>, res: WorkspaceResponse) {
  try {
    const body = parseBody(cardOrderSchema, req.body)
    await respondWithChange(res, req.params.id, (workspace) => setCardOrder(workspace, body.ids))
  } catch (error) {
    sendError(res, error)
  }
}
