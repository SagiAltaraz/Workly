import type { Request, Response } from 'express'
import { z } from 'zod'
import {
  addBriefItem,
  answerMissingDetail,
  clearField,
  deleteBriefItem,
  editBriefItem,
  editField,
  promoteSuggestion,
  restoreBriefItem,
} from '../pipeline/edits'
import type { ApiResponse } from '../types/api'
import type { Workspace } from '../types/workspace'
import { parseBody, respondWithChange } from './request'
import { sendError } from './respond'

type WorkspaceResponse = Response<ApiResponse<Workspace>>
type ItemParams = { id: string; itemId: string }

const fieldKeySchema = z.enum(['client', 'campaign', 'message', 'audience', 'tone', 'deadline', 'launchDate'])
const fieldBodySchema = z.object({ value: z.string().nullable() })
const newItemSchema = z.object({ list: z.enum(['deliverables', 'constraints']), text: z.string() })
const textSchema = z.object({ text: z.string() })
const promoteSchema = z.object({ into: z.enum(['deliverables', 'constraints']) })
const answerSchema = z.object({ answer: z.string() })

// A null value clears the field; any other value is the person's edit.
export async function updateBriefField(req: Request<{ id: string; key: string }>, res: WorkspaceResponse) {
  try {
    const key = parseBody(fieldKeySchema, req.params.key)
    const { value } = parseBody(fieldBodySchema, req.body)
    await respondWithChange(res, req.params.id, (workspace) =>
      value === null
        ? clearField(workspace, { type: 'brief', key })
        : editField(workspace, { type: 'brief', key }, value),
    )
  } catch (error) {
    sendError(res, error)
  }
}

export async function createBriefItem(req: Request<{ id: string }>, res: WorkspaceResponse) {
  try {
    const body = parseBody(newItemSchema, req.body)
    await respondWithChange(res, req.params.id, (workspace) => addBriefItem(workspace, body.list, body.text), 201)
  } catch (error) {
    sendError(res, error)
  }
}

export async function updateBriefItem(req: Request<ItemParams>, res: WorkspaceResponse) {
  try {
    const body = parseBody(textSchema, req.body)
    await respondWithChange(res, req.params.id, (workspace) => editBriefItem(workspace, req.params.itemId, body.text))
  } catch (error) {
    sendError(res, error)
  }
}

export async function removeBriefItem(req: Request<ItemParams>, res: WorkspaceResponse) {
  try {
    await respondWithChange(res, req.params.id, (workspace) => deleteBriefItem(workspace, req.params.itemId))
  } catch (error) {
    sendError(res, error)
  }
}

export async function reviveBriefItem(req: Request<ItemParams>, res: WorkspaceResponse) {
  try {
    await respondWithChange(res, req.params.id, (workspace) => restoreBriefItem(workspace, req.params.itemId))
  } catch (error) {
    sendError(res, error)
  }
}

export async function acceptSuggestion(req: Request<ItemParams>, res: WorkspaceResponse) {
  try {
    const body = parseBody(promoteSchema, req.body)
    await respondWithChange(res, req.params.id, (workspace) => promoteSuggestion(workspace, req.params.itemId, body.into))
  } catch (error) {
    sendError(res, error)
  }
}

export async function answerDetail(req: Request<ItemParams>, res: WorkspaceResponse) {
  try {
    const body = parseBody(answerSchema, req.body)
    await respondWithChange(res, req.params.id, (workspace) => answerMissingDetail(workspace, req.params.itemId, body.answer))
  } catch (error) {
    sendError(res, error)
  }
}
