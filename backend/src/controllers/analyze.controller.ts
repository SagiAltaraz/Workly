import type { Request, Response } from 'express'
import { z } from 'zod'
import { NoModelConfiguredError, NotFoundError, ValidationError } from '../errors'
import { runPipeline } from '../pipeline/runPipeline'
import { extractor } from '../services/extractor.service'
import * as workspaceService from '../services/workspace.service'
import type { AnalyzeEvent, ApiResponse } from '../types/api'
import type { CommandResult } from '../types/command'
import { sendError } from './respond'

const analyzeBodySchema = z.object({
  text: z.string().max(30_000),
  referenceDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
})

// Answers as a server-sent stream so the UI can show each stage while the run is in flight.
// Anything wrong before the stream opens is an ordinary JSON error.
export async function analyzeText(req: Request<{ id: string }>, res: Response<ApiResponse<never>>) {
  try {
    const body = analyzeBodySchema.safeParse(req.body)
    if (!body.success) throw new ValidationError('גוף הבקשה אינו תקין')
    if (!extractor) throw new NoModelConfiguredError()
    if (!workspaceService.getWorkspace(req.params.id)) throw new NotFoundError('ה-workspace לא נמצא')

    res.status(200).set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    })
    res.flushHeaders()
    const send = (event: AnalyzeEvent) => res.write(`data: ${JSON.stringify(event)}\n\n`)

    try {
      let commandResults: CommandResult[] = []
      const updated = await workspaceService.applyChange(req.params.id, async (current) => {
        const result = await runPipeline(
          current,
          { text: body.data.text, userReferenceDate: body.data.referenceDate ?? null },
          extractor!,
          (event) => send({ ok: true, type: 'stage', event }),
        )
        commandResults = result.commandResults
        return { workspace: result.workspace, label: result.label }
      })
      send({ ok: true, type: 'done', workspace: updated, commandResults })
    } catch (error) {
      console.error('analyze failed', error)
      const message = error instanceof ValidationError ? error.message : 'החילוץ נכשל. אפשר לנסות שוב.'
      send({ ok: false, type: 'error', error: message })
    }
    res.end()
  } catch (error) {
    sendError(res, error)
  }
}
