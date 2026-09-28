import type { Request, Response } from 'express'
import { z } from 'zod'
import { addTask, deleteTask, patchTask, restoreTask } from '../pipeline/edits'
import type { ApiResponse } from '../types/api'
import type { Workspace } from '../types/workspace'
import { parseBody, respondWithChange } from './request'
import { sendError } from './respond'

type WorkspaceResponse = Response<ApiResponse<Workspace>>
type TaskParams = { id: string; taskId: string }

const newTaskSchema = z.object({
  title: z.string(),
  listedUnder: z.enum(['today', 'week']),
  dueDate: z.string().nullable().optional(),
  dueTime: z.string().nullable().optional(),
})

const taskPatchSchema = z.object({
  title: z.string().optional(),
  done: z.boolean().optional(),
  dueDate: z.string().nullable().optional(),
  dueTime: z.string().nullable().optional(),
  conditionResolved: z.literal(true).optional(),
})

export async function createTask(req: Request<{ id: string }>, res: WorkspaceResponse) {
  try {
    const body = parseBody(newTaskSchema, req.body)
    await respondWithChange(
      res,
      req.params.id,
      (workspace) => addTask(workspace, { ...body, dueDate: body.dueDate ?? null, dueTime: body.dueTime ?? null }),
      201,
    )
  } catch (error) {
    sendError(res, error)
  }
}

export async function updateTask(req: Request<TaskParams>, res: WorkspaceResponse) {
  try {
    const body = parseBody(taskPatchSchema, req.body)
    await respondWithChange(res, req.params.id, (workspace) => patchTask(workspace, req.params.taskId, body))
  } catch (error) {
    sendError(res, error)
  }
}

export async function removeTask(req: Request<TaskParams>, res: WorkspaceResponse) {
  try {
    await respondWithChange(res, req.params.id, (workspace) => deleteTask(workspace, req.params.taskId))
  } catch (error) {
    sendError(res, error)
  }
}

export async function reviveTask(req: Request<TaskParams>, res: WorkspaceResponse) {
  try {
    await respondWithChange(res, req.params.id, (workspace) => restoreTask(workspace, req.params.taskId))
  } catch (error) {
    sendError(res, error)
  }
}
