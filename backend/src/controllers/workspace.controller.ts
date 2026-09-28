import type { Request, Response } from 'express'
import { NotFoundError } from '../errors'
import * as workspaceService from '../services/workspace.service'
import type { ApiResponse } from '../types/api'
import type { Workspace } from '../types/workspace'
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
    const workspace = workspaceService.getWorkspace(req.params.id)
    if (!workspace) throw new NotFoundError('ה-workspace לא נמצא')
    sendOk(res, workspace)
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
