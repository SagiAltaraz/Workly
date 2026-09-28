import type { Request, Response } from 'express'
import { z } from 'zod'
import { addMeeting, deleteMeeting, patchMeeting, restoreMeeting } from '../pipeline/edits'
import type { ApiResponse } from '../types/api'
import type { Workspace } from '../types/workspace'
import { parseBody, respondWithChange } from './request'
import { sendError } from './respond'

type WorkspaceResponse = Response<ApiResponse<Workspace>>
type MeetingParams = { id: string; meetingId: string }

const newMeetingSchema = z.object({
  topic: z.string(),
  date: z.string().nullable().optional(),
  startTime: z.string().nullable().optional(),
  endTime: z.string().nullable().optional(),
  participants: z.array(z.string()).optional(),
})

const meetingPatchSchema = z.object({
  topic: z.string().optional(),
  participants: z.array(z.string()).optional(),
  date: z.string().nullable().optional(),
  startTime: z.string().nullable().optional(),
  endTime: z.string().nullable().optional(),
})

export async function createMeeting(req: Request<{ id: string }>, res: WorkspaceResponse) {
  try {
    const body = parseBody(newMeetingSchema, req.body)
    await respondWithChange(
      res,
      req.params.id,
      (workspace) =>
        addMeeting(workspace, {
          topic: body.topic,
          date: body.date ?? null,
          startTime: body.startTime ?? null,
          endTime: body.endTime ?? null,
          participants: body.participants ?? [],
        }),
      201,
    )
  } catch (error) {
    sendError(res, error)
  }
}

export async function updateMeeting(req: Request<MeetingParams>, res: WorkspaceResponse) {
  try {
    const body = parseBody(meetingPatchSchema, req.body)
    await respondWithChange(res, req.params.id, (workspace) => patchMeeting(workspace, req.params.meetingId, body))
  } catch (error) {
    sendError(res, error)
  }
}

export async function removeMeeting(req: Request<MeetingParams>, res: WorkspaceResponse) {
  try {
    await respondWithChange(res, req.params.id, (workspace) => deleteMeeting(workspace, req.params.meetingId))
  } catch (error) {
    sendError(res, error)
  }
}

export async function reviveMeeting(req: Request<MeetingParams>, res: WorkspaceResponse) {
  try {
    await respondWithChange(res, req.params.id, (workspace) => restoreMeeting(workspace, req.params.meetingId))
  } catch (error) {
    sendError(res, error)
  }
}
