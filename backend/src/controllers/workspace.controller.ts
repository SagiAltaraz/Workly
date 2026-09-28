import type { Request, Response } from 'express'
import * as workspaceService from '../services/workspace.service'
import type { WorkspaceRecord } from '../db/workspace.repository'
import type { ApiResponse } from '../types/api'

export async function createWorkspace(
  _req: Request,
  res: Response<ApiResponse<WorkspaceRecord>>,
) {
  try {
    const workspace = await workspaceService.createWorkspace()
    res.status(201).json({ ok: true, data: workspace })
  } catch (error) {
    console.error('createWorkspace failed', error)
    res.status(500).json({ ok: false, error: 'Could not create workspace' })
  }
}

export async function getWorkspace(
  req: Request<{ id: string }>,
  res: Response<ApiResponse<WorkspaceRecord>>,
) {
  try {
    const workspace = await workspaceService.getWorkspace(req.params.id)
    if (!workspace) {
      res.status(404).json({ ok: false, error: 'Workspace not found' })
      return
    }
    res.status(200).json({ ok: true, data: workspace })
  } catch (error) {
    console.error('getWorkspace failed', error)
    res.status(500).json({ ok: false, error: 'Could not load workspace' })
  }
}
