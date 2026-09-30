import { readFile } from 'node:fs/promises'
import type { Request, Response } from 'express'
import { demoFiles, demoWorkspaceId } from '../config/demo'
import { NoModelConfiguredError } from '../errors'
import { runPipeline } from '../pipeline/runPipeline'
import { extractor } from '../services/extractor.service'
import * as workspaceService from '../services/workspace.service'
import type { ApiResponse } from '../types/api'
import type { Workspace } from '../types/workspace'
import { sendError, sendOk } from './respond'

// Seeded once, the first time anyone asks for the demo; every request after that (from any visitor)
// gets the same cached workspace straight away. Concurrent first requests share one seeding run instead
// of each replaying the three texts through the model.
let seeding: Promise<Workspace> | null = null

async function seedDemoWorkspace(): Promise<Workspace> {
  let workspace = workspaceService.getOrCreateWorkspace(demoWorkspaceId)
  for (const file of demoFiles) {
    const text = await readFile(new URL(`../../samples/${file}`, import.meta.url), 'utf8')
    workspace = await workspaceService.applyChange(demoWorkspaceId, async (current) => {
      const result = await runPipeline(current, { text, userReferenceDate: null }, extractor!, () => undefined)
      return { workspace: result.workspace, label: result.label }
    })
  }
  return workspace
}

// The three assignment texts (brief, tasks, meetings), run through the real pipeline and the real
// model once, then reused. Not a lookup table of canned answers: the very first call is a genuine
// extraction, exactly like pasting the same texts into the chat.
export async function loadDemoWorkspace(_req: Request, res: Response<ApiResponse<Workspace>>) {
  try {
    const existing = workspaceService.getWorkspace(demoWorkspaceId)
    if (existing && existing.sources.length > 0) {
      sendOk(res, existing)
      return
    }
    if (!extractor) throw new NoModelConfiguredError()
    seeding ??= seedDemoWorkspace().finally(() => {
      seeding = null
    })
    sendOk(res, await seeding)
  } catch (error) {
    sendError(res, error)
  }
}
