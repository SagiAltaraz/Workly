import type { Request, Response } from 'express'
import { z } from 'zod'
import {
  addBrief,
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
type BriefParams = { id: string; briefId: string }
type ItemParams = { id: string; itemId: string }

const fieldKeySchema = z.enum(['client', 'campaign', 'message', 'audience', 'tone', 'deadline', 'launchDate'])
const fieldBodySchema = z.object({ value: z.string().nullable() })
const newItemSchema = z.object({ list: z.enum(['deliverables', 'constraints']), text: z.string() })
const textSchema = z.object({ text: z.string() })
const promoteSchema = z.object({ into: z.enum(['deliverables', 'constraints']) })
const answerSchema = z.object({ answer: z.string() })

export async function createBrief(req: Request<{ id: string }>, res: WorkspaceResponse) {
  try {
    await respondWithChange(res, req.params.id, (workspace) => addBrief(workspace), 201)
  } catch (error) {
    sendError(res, error)
  }
}

// A null value clears the field; any other value is the person's edit.
export async function updateBriefField(req: Request<BriefParams & { key: string }>, res: WorkspaceResponse) {
  try {
    const key = parseBody(fieldKeySchema, req.params.key)
    const { value } = parseBody(fieldBodySchema, req.body)
    const target = { type: 'brief' as const, briefId: req.params.briefId, key }
    await respondWithChange(res, req.params.id, (workspace) =>
      value === null ? clearField(workspace, target) : editField(workspace, target, value),
    )
  } catch (error) {
    sendError(res, error)
  }
}

// Adds an item to a specific existing brief (mounted at /brief/:briefId/items), or starts a brand
// new brief with that item as its first content (mounted at /brief/items, no briefId - the empty
// state's own "+ תוצר / + תנאי" buttons).
export async function createBriefItem(req: Request<{ id: string; briefId?: string }>, res: WorkspaceResponse) {
  try {
    const body = parseBody(newItemSchema, req.body)
    await respondWithChange(res, req.params.id, (workspace) => addBriefItem(workspace, req.params.briefId ?? null, body.list, body.text), 201)
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
