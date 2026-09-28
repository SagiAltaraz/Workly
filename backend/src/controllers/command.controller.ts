import type { Request, Response } from 'express'
import { z } from 'zod'
import { executeCommand } from '../pipeline/commands/executeCommand'
import type { ApiResponse } from '../types/api'
import type { Workspace } from '../types/workspace'
import { parseBody, respondWithChange } from './request'
import { sendError } from './respond'

const commandSchema = z.object({
  action: z.enum([
    'addTask',
    'editTask',
    'completeTask',
    'reopenTask',
    'deleteTask',
    'unblockTask',
    'addMeeting',
    'editMeeting',
    'deleteMeeting',
  ]),
  quote: z.string(),
  title: z.string().nullable(),
  date: z.string().nullable(),
  startTime: z.string().nullable(),
  endTime: z.string().nullable(),
  participants: z.array(z.string()),
})

const executeSchema = z.object({ command: commandSchema, targetId: z.string().nullable() })

// The second step of an instruction that named more than one possible item: the person picked one.
export async function executeChosenCommand(req: Request<{ id: string }>, res: Response<ApiResponse<Workspace>>) {
  try {
    const body = parseBody(executeSchema, req.body)
    await respondWithChange(res, req.params.id, (workspace) => executeCommand(workspace, body.command, body.targetId))
  } catch (error) {
    sendError(res, error)
  }
}
